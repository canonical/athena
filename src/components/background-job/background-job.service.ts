import { backendConfig } from "@components/config/backend-config.js";
import { log } from "@components/logging/logging.service.js";
import { type QueryExecutor, query } from "@components/postgres/postgres.js";
import { type Db, events, PgBoss } from "pg-boss";
import { z } from "zod";
import { BackgroundJobConfigurationError, BackgroundJobPermanentError, BackgroundJobUnavailableError } from "./background-job.errors.js";
import { backgroundJobSealRegistry } from "./background-job.registry.js";
import { type BackgroundJobDefinition, type BackgroundJobEnqueueOptions, type BackgroundJobEnqueueResult, type BackgroundJobPayloadEnvelope, backgroundJobPayloadEnvelopeSchema } from "./background-job.schema.js";

type BackgroundJobClientRole = `producer` | `worker`;

const toPgBossDatabase = (executor: QueryExecutor): Db => ({
  executeSql: async (text, values) => executor.query(text, values),
});

const createBoss = (role: BackgroundJobClientRole): PgBoss => {
  const worker = role === `worker`;
  const boss = new PgBoss({
    db: toPgBossDatabase({ query }),
    schema: backendConfig.backgroundJobs.schema,
    createSchema: false,
    migrate: false,
    schedule: worker,
    supervise: worker,
  });

  boss.on(events.error, (error) => {
    log.error(`Background job ${role} error`, {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
    });
  });

  boss.on(events.warning, (warning) => {
    log.warn(`Background job ${role} warning`, { warning });
  });

  return boss;
};

let producer: PgBoss | undefined;
let producerStart: Promise<void> | undefined;

const verifyInstalledSchema = async (boss: PgBoss): Promise<void> => {
  if (!(await boss.isInstalled())) {
    throw new BackgroundJobConfigurationError(`Background job schema \`${backendConfig.backgroundJobs.schema}\` is not installed.`);
  }
};

const stopAfterStartupFailure = async (boss: PgBoss): Promise<void> => {
  try {
    await boss.stop({ close: false, graceful: false });
  } catch (error) {
    log.error(`Background job cleanup after startup failure failed`, {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
    });
  }
};

export const backgroundJobStartProducer = async (): Promise<void> => {
  if (producer) {
    return;
  }

  if (producerStart) {
    return producerStart;
  }

  producerStart = (async () => {
    const definitions = backgroundJobSealRegistry();
    const nextProducer = createBoss(`producer`);

    try {
      await nextProducer.start();
      await verifyInstalledSchema(nextProducer);
      await ensureQueues(nextProducer, definitions);
      producer = nextProducer;
      log.info(`Background job producer started`, { instanceId: backendConfig.runtime.instanceId });
    } catch (error) {
      await stopAfterStartupFailure(nextProducer);
      throw error;
    }
  })().finally(() => {
    producerStart = undefined;
  });

  return producerStart;
};

export const backgroundJobStopProducer = async (): Promise<void> => {
  if (producerStart) {
    await producerStart;
  }

  const currentProducer = producer;
  producer = undefined;

  if (!currentProducer) {
    return;
  }

  await currentProducer.stop({ close: false, graceful: true, timeout: backendConfig.backgroundJobs.shutdownTimeoutMs });
  log.info(`Background job producer stopped`, { instanceId: backendConfig.runtime.instanceId });
};

export const backgroundJobEnqueue = async <TPayload extends Record<string, unknown>>(definition: BackgroundJobDefinition<TPayload>, payload: TPayload, options: BackgroundJobEnqueueOptions = {}): Promise<BackgroundJobEnqueueResult> => {
  if (!producer) {
    throw new BackgroundJobUnavailableError(`Background job producer has not started.`);
  }

  const validatedPayload = definition.payloadSchema.parse(payload);
  const envelope: BackgroundJobPayloadEnvelope = { version: definition.version, payload: validatedPayload };
  const jobId = await producer.send(definition.name, envelope, options);

  return jobId ? { accepted: true, jobId } : { accepted: false, jobId: null };
};

export const backgroundJobFind = async <TPayload extends Record<string, unknown>>(definition: BackgroundJobDefinition<TPayload>, jobId: string) => {
  if (!producer) {
    throw new BackgroundJobUnavailableError(`Background job producer has not started.`);
  }

  const jobs = await producer.findJobs<BackgroundJobPayloadEnvelope>(definition.name, { id: jobId });
  return jobs[0] ?? null;
};

async function ensureQueues(boss: PgBoss, definitions: readonly BackgroundJobDefinition[]): Promise<void> {
  for (const definition of definitions) {
    const queue = {
      retryLimit: backendConfig.backgroundJobs.retryLimit,
      retryDelay: backendConfig.backgroundJobs.retryDelaySeconds,
      retryBackoff: true,
      ...definition.queue,
    };
    const { policy: _policy, ...mutableQueueOptions } = queue;
    await boss.createQueue(definition.name, queue);
    await boss.updateQueue(definition.name, mutableQueueOptions);
  }

  const queues = new Map((await boss.getQueues(definitions.map(({ name }) => name))).map((queue) => [queue.name, queue]));

  for (const definition of definitions) {
    const expectedPolicy = definition.queue?.policy ?? `standard`;
    const actualPolicy = queues.get(definition.name)?.policy;

    if (actualPolicy !== expectedPolicy) {
      throw new BackgroundJobConfigurationError(`Background queue \`${definition.name}\` uses policy \`${actualPolicy ?? `missing`}\`; expected \`${expectedPolicy}\`.`);
    }
  }
}

export const backgroundJobCreateWorker = async (): Promise<PgBoss> => {
  const definitions = backgroundJobSealRegistry();
  const worker = createBoss(`worker`);

  try {
    await worker.start();
    await verifyInstalledSchema(worker);
    await ensureQueues(worker, definitions);

    for (const definition of definitions) {
      const workerOptions = {
        localConcurrency: backendConfig.backgroundJobs.workerConcurrency,
        ...definition.worker,
        includeMetadata: true,
        perJobResults: true,
      } as const;

      await worker.work<BackgroundJobPayloadEnvelope, Record<string, unknown>, typeof workerOptions>(definition.name, workerOptions, async (jobs) =>
        Promise.all(
          jobs.map(async (job) => {
            try {
              const envelope = backgroundJobPayloadEnvelopeSchema.parse(job.data);

              if (envelope.version !== definition.version) {
                throw new BackgroundJobPermanentError(`Unsupported payload version ${envelope.version}; expected ${definition.version}.`);
              }

              const payload = definition.payloadSchema.parse(envelope.payload);
              const output = await definition.handler({ job, payload });
              log.info(`Background job completed`, { attempt: job.retryCount + 1, jobId: job.id, jobName: definition.name });
              return { id: job.id, status: `completed` as const, output };
            } catch (error) {
              const permanent = error instanceof BackgroundJobPermanentError || error instanceof z.ZodError;
              const message = error instanceof Error ? error.message : String(error);
              log.error(`Background job failed`, {
                attempt: job.retryCount + 1,
                jobId: job.id,
                jobName: definition.name,
                permanent,
                error: error instanceof Error ? { name: error.name, message, stack: error.stack } : { message },
              });
              return { id: job.id, status: permanent ? (`deadletter` as const) : (`failed` as const), output: { message } };
            }
          }),
        ),
      );
    }
  } catch (error) {
    await stopAfterStartupFailure(worker);
    throw error;
  }

  log.info(`Background job worker started`, { instanceId: backendConfig.runtime.instanceId, registeredJobCount: definitions.length });
  return worker;
};
