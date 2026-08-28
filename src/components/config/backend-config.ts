import { hostname } from "node:os";
import { createEnvAccessor } from "@components/config/env-accessor.js";

const env = createEnvAccessor({ prefixes: [`APP_ATHENA`, `APP`], allowEmpty: true });
const requiredEnv = createEnvAccessor({ prefixes: [`APP_ATHENA`, `APP`], allowEmpty: false });

const positiveInteger = (name: string, value: number): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Environment variable must be a positive integer: ${name}`);
  }

  return value;
};

const nonNegativeInteger = (name: string, value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Environment variable must be a non-negative integer: ${name}`);
  }

  return value;
};

const backgroundJobSchema = env.getEnv(`BACKGROUND_JOB_SCHEMA`, `pgboss`);

if (!/^[a-z][a-z0-9_]*$/u.test(backgroundJobSchema)) {
  throw new Error(`BACKGROUND_JOB_SCHEMA must be a lowercase PostgreSQL identifier.`);
}

export const backendConfig = {
  runtime: {
    instanceId: env.getEnv(`INSTANCE_ID`, process.env.JUJU_UNIT_NAME ?? hostname()),
  },
  logging: {
    traceHeaderName: env.getEnv(`LOG_TRACE_HEADER_NAME`, `traceparent`),
    serviceName: env.getEnv(`LOG_SERVICE_NAME`, `athena-service`),
    level: env.getEnv(`LOG_LEVEL`, `info`),
    enabled: env.getBoolean(`LOG_ENABLED`, true),
  },
  database: {
    connectionString: requiredEnv.getEnv(`POSTGRESQL_DB_CONNECT_STRING`),
    poolMax: positiveInteger(`PG_POOL_MAX`, env.getNumber(`PG_POOL_MAX`, 1)),
    poolIdleTimeoutMs: positiveInteger(`PG_POOL_IDLE_TIMEOUT_MS`, env.getNumber(`PG_POOL_IDLE_TIMEOUT_MS`, 60_000)),
    connectionTimeoutMs: positiveInteger(`PG_CONNECTION_TIMEOUT_MS`, env.getNumber(`PG_CONNECTION_TIMEOUT_MS`, 10_000)),
  },
  backgroundJobs: {
    schema: backgroundJobSchema,
    workerConcurrency: positiveInteger(`BACKGROUND_JOB_WORKER_CONCURRENCY`, env.getNumber(`BACKGROUND_JOB_WORKER_CONCURRENCY`, 2)),
    retryLimit: nonNegativeInteger(`BACKGROUND_JOB_RETRY_LIMIT`, env.getNumber(`BACKGROUND_JOB_RETRY_LIMIT`, 3)),
    retryDelaySeconds: nonNegativeInteger(`BACKGROUND_JOB_RETRY_DELAY_SECONDS`, env.getNumber(`BACKGROUND_JOB_RETRY_DELAY_SECONDS`, 5)),
    shutdownTimeoutMs: positiveInteger(`BACKGROUND_JOB_SHUTDOWN_TIMEOUT_MS`, env.getNumber(`BACKGROUND_JOB_SHUTDOWN_TIMEOUT_MS`, 30_000)),
  },
};

Object.freeze(backendConfig);

export type BackendConfig = typeof backendConfig;
