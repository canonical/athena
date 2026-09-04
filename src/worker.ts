import { backgroundJobCreateWorker } from "@components/background-job/background-job.service.js";
import { backendConfig } from "@components/config/backend-config.js";
import { log } from "@components/logging/logging.service.js";
import { closePG, ensurePG } from "@components/postgres/postgres.js";

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

const worker = await startWorker();
let stopping = false;

const stop = async (signal: NodeJS.Signals): Promise<void> => {
  if (stopping) {
    return;
  }

  stopping = true;
  log.info(`Athena worker stopping`, { signal });

  try {
    await worker.stop({ close: false, graceful: true, timeout: backendConfig.backgroundJobs.shutdownTimeoutMs });
    await closePG();
    log.info(`Athena worker stopped`, { signal });
  } catch (error) {
    process.exitCode = 1;
    log.error(`Athena worker shutdown failed`, {
      signal,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
    });
  }
};

process.once(`SIGTERM`, () => void stop(`SIGTERM`));
process.once(`SIGINT`, () => void stop(`SIGINT`));

log.info(`Athena worker process ready`, { instanceId: backendConfig.runtime.instanceId });
