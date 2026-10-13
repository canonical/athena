import { log } from "@components/logging/logging.service.js";
import { Pool, types as pgTypes } from "pg";

export type PoolOptions = {
  applicationName?: string;
  connectionTimeoutMillis?: number;
  connectionString: string;
  idleTimeoutMillis?: number;
  max?: number;
};

let pool: Pool | undefined;
let initialized = false;
let typeParsersConfigured = false;
let closePromise: Promise<void> | undefined;

const toSafeInteger = (value: string): number | string => {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) ? parsed : value;
};

const toFiniteNumber = (value: string): number | string => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : value;
};

const configureTypeParsers = (): void => {
  if (typeParsersConfigured) {
    return;
  }

  pgTypes.setTypeParser(pgTypes.builtins.INT8, (value) => toSafeInteger(value));
  pgTypes.setTypeParser(pgTypes.builtins.NUMERIC, (value) => toFiniteNumber(value));
  pgTypes.setTypeParser(pgTypes.builtins.FLOAT8, (value) => toFiniteNumber(value));
  pgTypes.setTypeParser(pgTypes.builtins.FLOAT4, (value) => toFiniteNumber(value));

  typeParsersConfigured = true;
};

export const ensurePG = (options: PoolOptions): Pool => {
  if (initialized && pool) {
    return pool;
  }

  const { connectionString } = options;

  if (!connectionString) {
    throw new Error(`PostgreSQL connection string is required to initialize the pool.`);
  }

  configureTypeParsers();
  pool = new Pool({
    application_name: options.applicationName,
    connectionString,
    connectionTimeoutMillis: options.connectionTimeoutMillis,
    idleTimeoutMillis: options.idleTimeoutMillis,
    max: options.max,
  });
  pool.on(`error`, (error) => {
    log.error(`Unexpected PostgreSQL client error`, {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
    });
  });
  initialized = true;

  return pool;
};

export const getPool = (): Pool => {
  if (!pool) {
    throw new Error(`PostgreSQL pool not configured. Call ensurePG before accessing the pool.`);
  }

  return pool;
};

export const closePG = async (): Promise<void> => {
  if (closePromise) {
    return closePromise;
  }

  const currentPool = pool;
  pool = undefined;
  initialized = false;

  if (!currentPool) {
    return;
  }

  closePromise = currentPool.end().finally(() => {
    closePromise = undefined;
  });

  return closePromise;
};

type PoolQuery = ReturnType<typeof getPool>[`query`];

export type QueryExecutor = Pick<Pool, `query`>;

export const query: PoolQuery = ((...args: Parameters<PoolQuery>) => {
  const poolInstance = getPool();
  return poolInstance.query(...args);
}) as PoolQuery;
