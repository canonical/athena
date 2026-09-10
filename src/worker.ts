import { backgroundJobRegister } from "@components/background-job/background-job.registry.js";
import { backgroundJobCreateWorker } from "@components/background-job/background-job.service.js";
import "@components/rag/rag.job.js";
import { backendConfig } from "@components/config/backend-config.js";
import { log } from "@components/logging/logging.service.js";
import { closePG, ensurePG } from "@components/postgres/postgres.js";
import { startRunnerQueueConsumer, stopRunnerQueueConsumer } from "@components/runner/runner.queue.consumer.js";
import { startTaskProcessor, stopTaskProcessor } from "@components/task/task.processor.js";
import { webhookBackgroundJobDefinition } from "@components/webhook/webhook.background-job.js";

ensurePG({
  applicationName: `athena-worker/${backendConfig.runtime.instanceId}`,
  connectionString: backendConfig.database.connectionString,
  connectionTimeoutMillis: backendConfig.database.connectionTimeoutMs,
  idleTimeoutMillis: backendConfig.database.poolIdleTimeoutMs,
  max: backendConfig.database.poolMax,
});

const startWorker = async () => {
  try {
    return await backgroundJobCreateWorker();
  } catch (error) {
    await closePG();
    throw error;
  }
};

backgroundJobRegister(webhookBackgroundJobDefinition);
const worker = await startWorker();
startTaskProcessor();
startRunnerQueueConsumer();
let stopping = false;

const stop = async (signal: NodeJS.Signals): Promise<void> => {
  if (stopping) {
    return;
  }

  stopping = true;
  log.info(`Athena worker stopping`, { signal });
  const forceShutdown = setTimeout(() => {
    log.error(`Athena worker graceful shutdown timed out`, {
      signal,
      timeoutMs: backendConfig.backgroundJobs.shutdownTimeoutMs,
    });
    process.exit(1);
  }, backendConfig.backgroundJobs.shutdownTimeoutMs);

  try {
    stopTaskProcessor();
    stopRunnerQueueConsumer();
    await worker.stop({ close: false, graceful: true, timeout: backendConfig.backgroundJobs.shutdownTimeoutMs });
  } catch (error) {
    process.exitCode = 1;
    log.error(`Athena worker shutdown failed`, {
      signal,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
    });
  } finally {
    try {
      await closePG();
    } catch (error) {
      process.exitCode = 1;
      log.error(`Athena worker PostgreSQL shutdown failed`, {
        signal,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
      });
    }

    clearTimeout(forceShutdown);
  }

  log.info(`Athena worker stopped`, { signal, exitCode: process.exitCode ?? 0 });
};

process.once(`SIGTERM`, () => void stop(`SIGTERM`));
process.once(`SIGINT`, () => void stop(`SIGINT`));

log.info(`Athena worker process ready`, { instanceId: backendConfig.runtime.instanceId });
