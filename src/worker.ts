import { backgroundJobCreateWorker } from "@components/background-job/background-job.service.js";
import { backendConfig } from "@components/config/backend-config.js";
import { log } from "@components/logging/logging.service.js";
import { closePG, ensurePG } from "@components/postgres/postgres.js";

ensurePG({ connectionString: backendConfig.database.connectionString });

const startWorker = async () => {
  try {
    return await backgroundJobCreateWorker();
  } catch (error) {
    try {
      await closePG();
    } catch (cleanupError) {
      log.error(`Athena worker PostgreSQL cleanup after startup failure failed`, {
        error: cleanupError instanceof Error ? { name: cleanupError.name, message: cleanupError.message, stack: cleanupError.stack } : { message: String(cleanupError) },
      });
    }
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

  let shutdownFailed = false;
  try {
    await worker.stop({ close: false, graceful: true, timeout: backendConfig.backgroundJobs.shutdownTimeoutMs });
  } catch (error) {
    shutdownFailed = true;
    log.error(`Athena worker shutdown failed`, {
      signal,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
    });
  } finally {
    try {
      await closePG();
    } catch (error) {
      shutdownFailed = true;
      log.error(`Athena worker PostgreSQL shutdown failed`, {
        signal,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
      });
    }
  }

  if (!shutdownFailed) log.info(`Athena worker stopped`, { signal });
  process.exitCode = shutdownFailed ? 1 : 0;
};

process.once(`SIGTERM`, () => void stop(`SIGTERM`));
process.once(`SIGINT`, () => void stop(`SIGINT`));

log.info(`Athena worker started`);
