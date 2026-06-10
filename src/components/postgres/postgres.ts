import { Pool, types as pgTypes } from "pg";

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
    console.error(`Unexpected PostgreSQL client error`, { error });
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
