import { backendConfig } from "@components/config/backend-config.js";
import { log } from "@components/logging/logging.service.js";
import { type QueryExecutor, query } from "@components/postgres/postgres.js";
import { type Db, events, PgBoss } from "pg-boss";
import { z } from "zod";
import { BackgroundJobConfigurationError, BackgroundJobEnqueueError, BackgroundJobPermanentError } from "./background-job.errors.js";
import { backgroundJobDefinitions, backgroundJobValidateRegistry } from "./background-job.registry.js";
import { type BackgroundJobDefinition, type BackgroundJobEnqueueOptions, type BackgroundJobPayloadEnvelope, backgroundJobPayloadEnvelopeSchema } from "./background-job.schema.js";

const toPgBossDatabase = (executor: QueryExecutor): Db => ({
  executeSql: async (text, values) => executor.query(text, values),
});

const createBoss = (supervise: boolean): PgBoss => {
  const boss = new PgBoss({
    db: toPgBossDatabase({ query }),
    createSchema: false,
    migrate: false,
    schedule: false,
    supervise,
  });

  boss.on(events.error, (error) => {
    log.error(`Background job runtime error`, {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
    });
  });

  boss.on(events.warning, (warning) => {
    log.warn(`Background job runtime warning`, { warning });
  });

  return boss;
};

let producer: PgBoss | null = null;

const ensureQueues = async (boss: PgBoss): Promise<void> => {
  for (const definition of backgroundJobDefinitions()) {
    await boss.createQueue(definition.name, {
      retryLimit: backendConfig.backgroundJobs.retryLimit,
      retryDelay: backendConfig.backgroundJobs.retryDelaySeconds,
      retryBackoff: true,
      ...definition.queue,
    });
  }

  const queues = new Map((await boss.getQueues(backgroundJobDefinitions().map(({ name }) => name))).map((queue) => [queue.name, queue]));
  for (const definition of backgroundJobDefinitions()) {
    const expectedPolicy = definition.queue?.policy ?? `standard`;
    const actualPolicy = queues.get(definition.name)?.policy;
    if (actualPolicy !== expectedPolicy) {
      throw new BackgroundJobConfigurationError(`Background queue \`${definition.name}\` uses policy \`${actualPolicy ?? `missing`}\`; expected \`${expectedPolicy}\`.`);
    }
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
  // Server startup calls this once; concurrent producer startup is intentionally unsupported.
  if (producer) {
    return;
  }

  backgroundJobValidateRegistry();
  const nextProducer = createBoss(false);

  try {
    await nextProducer.start();
    await ensureQueues(nextProducer);
    producer = nextProducer;
  } catch (error) {
    await stopAfterStartupFailure(nextProducer);
    throw error;
  }

  log.info(`Background job producer started`);
};

export const backgroundJobStopProducer = async (): Promise<void> => {
  if (!producer) {
    return;
  }

  const currentProducer = producer;
  producer = null;
  await currentProducer.stop({ close: false, graceful: true, timeout: backendConfig.backgroundJobs.shutdownTimeoutMs });
  log.info(`Background job producer stopped`);
};

export const backgroundJobEnqueue = async <TPayload extends Record<string, unknown>>(
  executor: QueryExecutor,
  definition: BackgroundJobDefinition<TPayload>,
  payload: TPayload,
  options: BackgroundJobEnqueueOptions = {},
): Promise<string | null> => {
  if (!producer) {
    throw new BackgroundJobEnqueueError(`Background job producer has not started.`);
  }

  const validatedPayload = definition.payloadSchema.parse(payload);
  const envelope: BackgroundJobPayloadEnvelope = { version: definition.version, payload: validatedPayload };

  return producer.send(definition.name, envelope, {
    db: toPgBossDatabase(executor),
    singletonKey: options.singletonKey,
  });
};

export const backgroundJobCreateWorker = async (): Promise<PgBoss> => {
  backgroundJobValidateRegistry();
  const worker = createBoss(true);

  try {
    await worker.start();
    await ensureQueues(worker);

    for (const definition of backgroundJobDefinitions()) {
      const workerOptions = { ...definition.worker, includeMetadata: true, perJobResults: true } as const;
      await worker.work<BackgroundJobPayloadEnvelope, unknown, typeof workerOptions>(definition.name, workerOptions, async (jobs) =>
        Promise.all(
          jobs.map(async (job) => {
            log.info(`Background job started`, { jobId: job.id, jobName: definition.name, attempt: job.retryCount + 1 });

            try {
              const envelope = backgroundJobPayloadEnvelopeSchema.parse(job.data);

              if (envelope.version !== definition.version) {
                throw new BackgroundJobPermanentError(`Unsupported payload version ${envelope.version}; expected ${definition.version}.`);
              }

              const payload = definition.payloadSchema.parse(envelope.payload);
              await definition.handler({ job, payload });
              log.info(`Background job completed`, { jobId: job.id, jobName: definition.name, attempt: job.retryCount + 1, payloadVersion: envelope.version });
              return { id: job.id, status: `completed` as const };
            } catch (error) {
              const permanent = error instanceof BackgroundJobPermanentError || error instanceof z.ZodError;
              const message = error instanceof Error ? error.message : String(error);
              log.error(`Background job failed`, {
                jobId: job.id,
                jobName: definition.name,
                attempt: job.retryCount + 1,
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

  return worker;
};
