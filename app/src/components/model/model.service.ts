import { type ModelUpsertRecord, modelUpsertRecordSchema } from "@components/model/model.schemas.js";
import { getPool, PostgresError } from "@portal/utilities/postgres";

const upsertModelQuery = `
  INSERT INTO "model" (
    "source",
    "slug",
    "href",
    "summary",
    "capabilities",
    "size",
    "contextTokens",
    "inputTypes",
    "readmeMarkdown",
    "license",
    "fetchedAt"
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    $5::jsonb,
    $6,
    $7,
    $8::jsonb,
    $9,
    $10::jsonb,
    $11::timestamptz
  )
  ON CONFLICT ("source", "slug")
  DO UPDATE SET
    "href" = EXCLUDED."href",
    "summary" = EXCLUDED."summary",
    "capabilities" = EXCLUDED."capabilities",
    "size" = EXCLUDED."size",
    "contextTokens" = EXCLUDED."contextTokens",
    "inputTypes" = EXCLUDED."inputTypes",
    "readmeMarkdown" = EXCLUDED."readmeMarkdown",
    "license" = EXCLUDED."license",
    "fetchedAt" = EXCLUDED."fetchedAt",
    "updatedAt" = NOW()
`;

const listModelsBySourceQuery = `
  SELECT
    "source",
    "slug",
    "href",
    "summary",
    "capabilities",
    "size",
    "contextTokens",
    "inputTypes",
    "readmeMarkdown",
    "license",
    "fetchedAt"
  FROM "model"
  WHERE "source" = $1
  ORDER BY "slug" ASC
`;

const toModelRowValues = (record: ModelUpsertRecord): unknown[] => {
  return [
    record.source,
    record.slug,
    record.href,
    record.summary,
    JSON.stringify(record.capabilities),
    record.size,
    record.contextTokens,
    JSON.stringify(record.inputTypes),
    record.readmeMarkdown,
    JSON.stringify(record.license),
    record.fetchedAt,
  ];
};

const toModelRecord = (row: Record<string, unknown>): ModelUpsertRecord => {
  const fetchedAt = row.fetchedAt;

  return modelUpsertRecordSchema.parse({
    ...row,
    fetchedAt: fetchedAt instanceof Date ? fetchedAt.toISOString() : fetchedAt,
  });
};

/**
 * Persists one normalized model row for later Athena use.
 */
export const upsertModel = async (record: ModelUpsertRecord): Promise<void> => {
  const pool = getPool();

  try {
    await pool.query(upsertModelQuery, toModelRowValues(record));
  } catch (error) {
    throw new PostgresError(`Failed to upsert model row`, error);
  }
};

/**
 * Loads persisted model rows for one catalog source.
 */
export const listModelsBySource = async (source: string): Promise<ModelUpsertRecord[]> => {
  const pool = getPool();

  try {
    const result = await pool.query<Record<string, unknown>>(listModelsBySourceQuery, [source]);

    return result.rows.map((row) => toModelRecord(row));
  } catch (error) {
    throw new PostgresError(`Failed to list model rows for source ${source}`, error);
  }
};
