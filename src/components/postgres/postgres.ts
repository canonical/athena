import { log } from "@components/logging/logging.service.js";
import { Pool, type PoolClient, types as pgTypes } from "pg";

type PoolOptions = {
  connectionString: string;
};

let pool: Pool | undefined;
let initialized = false;
let typeParsersConfigured = false;

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
  pool = new Pool({ connectionString });
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

export type QueryExecutor = Pick<Pool | PoolClient, `query`>;

export const withTransaction = async <T>(operation: (transaction: QueryExecutor) => Promise<T>): Promise<T> => {
  const client = await getPool().connect();
  let transactionStarted = false;

  try {
    await client.query(`BEGIN`);
    transactionStarted = true;
    const result = await operation(client);
    await client.query(`COMMIT`);
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query(`ROLLBACK`);
      } catch (rollbackError) {
        log.error(`PostgreSQL transaction rollback failed`, {
          error: rollbackError instanceof Error ? { name: rollbackError.name, message: rollbackError.message, stack: rollbackError.stack } : { message: String(rollbackError) },
        });
      }
    }

    throw error;
  } finally {
    client.release();
  }
};

export const closePG = async (): Promise<void> => {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
  initialized = false;
};

type PoolQuery = ReturnType<typeof getPool>[`query`];

export const query: PoolQuery = ((...args: Parameters<PoolQuery>) => {
  const poolInstance = getPool();
  return poolInstance.query(...args);
}) as PoolQuery;
