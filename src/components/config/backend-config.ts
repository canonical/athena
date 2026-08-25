import { createEnvAccessor } from "./env-accessor.js";

const env = createEnvAccessor({ prefixes: [`APP_ATHENA`, `APP`, `ATHENA`], allowEmpty: true });
const requiredEnv = createEnvAccessor({ prefixes: [`APP_ATHENA`, `APP`, `ATHENA`], allowEmpty: false });

const backgroundJobShutdownTimeoutMs = env.getNumber(`BACKGROUND_JOB_SHUTDOWN_TIMEOUT_MS`, 30_000);
const backgroundJobRetryLimit = env.getNumber(`BACKGROUND_JOB_RETRY_LIMIT`, 3);
const backgroundJobRetryDelaySeconds = env.getNumber(`BACKGROUND_JOB_RETRY_DELAY_SECONDS`, 5);

if (!Number.isInteger(backgroundJobShutdownTimeoutMs) || backgroundJobShutdownTimeoutMs < 1_000) {
  throw new Error(`BACKGROUND_JOB_SHUTDOWN_TIMEOUT_MS must be an integer of at least 1000 milliseconds.`);
}

if (!Number.isInteger(backgroundJobRetryLimit) || backgroundJobRetryLimit < 0) {
  throw new Error(`BACKGROUND_JOB_RETRY_LIMIT must be a non-negative integer.`);
}

if (!Number.isInteger(backgroundJobRetryDelaySeconds) || backgroundJobRetryDelaySeconds < 0) {
  throw new Error(`BACKGROUND_JOB_RETRY_DELAY_SECONDS must be a non-negative integer.`);
}

export const backendConfig = {
  credentials: {
    encryptionKey: requiredEnv.getEnv(`CREDENTIAL_ENCRYPTION_KEY`),
  },
  database: {
    connectionString: requiredEnv.getEnv(`POSTGRESQL_DB_CONNECT_STRING`),
  },
  backgroundJobs: {
    shutdownTimeoutMs: backgroundJobShutdownTimeoutMs,
    retryLimit: backgroundJobRetryLimit,
    retryDelaySeconds: backgroundJobRetryDelaySeconds,
  },
};

Object.freeze(backendConfig);

export type BackendConfig = typeof backendConfig;
