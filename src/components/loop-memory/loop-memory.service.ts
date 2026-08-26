import type { QueryExecutor } from "@components/postgres/postgres.js";
import { query } from "@components/postgres/postgres.js";
import { ProviderEmbedder } from "@components/provider/provider.embedder.service.js";
import type { ProviderEmbedderApiConnection } from "@components/provider/provider.service.js";
import { decryptSecret } from "@components/utilities/secret-envelope.js";
import type { LoopMemoryConfig } from "./loop-memory.schema.js";

type HistorySourceItem = {
  loop: string;
  task: string;
  queueItem: string;
  source: `queue` | `archive`;
  occurredAt: string;
  item: Record<string, unknown>;
};

type EmbedderRow = {
  providerType: `openrouter`;
  baseUrl: string;
  credentialCiphertext: string;
  credentialIv: string;
  credentialAuthTag: string;
  credentialKeyVersion: string;
  model: string;
  generation: string;
  embeddingDimensions: number | null;
};

type LoopMemoryEmbedder = {
  connection: ProviderEmbedderApiConnection;
  generation: string;
  embeddingDimensions: number | null;
};

const configSelect = `
  l."id" AS "loop",
  COALESCE(lhr."enabled", FALSE) AS "hasHistoryRag",
  lhr."provider",
  p."displayName" AS "providerDisplayName",
  pe."model" AS "embeddingModel",
  lhr."status",
  lhr."failureMessage",
  lhr."embeddingDimensions",
  lhr."updatedAt"
`;

export const queryLoopMemoryConfig = async (loopId: string, userId: string): Promise<LoopMemoryConfig | undefined> => {
  const result = await query<LoopMemoryConfig>(
    `SELECT ${configSelect}
     FROM "loop" l
     JOIN "loopUser" lu ON lu."loop" = l."id" AND lu."user" = $2
     LEFT JOIN "loopHistoryRag" lhr ON lhr."loop" = l."id"
     LEFT JOIN "providerEmbedder" pe ON pe."provider" = lhr."provider"
     LEFT JOIN "provider" p ON p."id" = pe."provider"
     WHERE l."id" = $1`,
    [loopId, userId],
  );
  return result.rows[0];
};

export const queryLoopMemoryDisable = async (executor: QueryExecutor, loopId: string, userId: string): Promise<boolean> => {
  const loopResult = await executor.query(
    `SELECT l."id"
     FROM "loop" l
     JOIN "loopUser" lu ON lu."loop" = l."id" AND lu."user" = $2 AND lu."isAdmin" = TRUE
     WHERE l."id" = $1
     FOR UPDATE OF l`,
    [loopId, userId],
  );
  if (!loopResult.rowCount) return false;

  const result = await executor.query(
    `UPDATE "loopHistoryRag" lhr SET "enabled" = FALSE, "status" = 'missing', "failureMessage" = NULL
     WHERE lhr."loop" = $1`,
    [loopId],
  );
  return (result.rowCount ?? 0) > 0;
};

export type LoopMemoryEnableResult = { outcome: `invalid` | `unchanged` } | { outcome: `rebuild`; generation: string };

export const queryLoopMemoryEnable = async (executor: QueryExecutor, loopId: string, providerId: string, userId: string): Promise<LoopMemoryEnableResult> => {
  const loopResult = await executor.query(
    `SELECT l."id"
     FROM "loop" l
     JOIN "loopUser" lu ON lu."loop" = l."id" AND lu."user" = $2 AND lu."isAdmin" = TRUE
     WHERE l."id" = $1
     FOR UPDATE OF l`,
    [loopId, userId],
  );
  if (!loopResult.rowCount) return { outcome: `invalid` };

  const providerResult = await executor.query<{ provider: string }>(
    `SELECT p."id" AS "provider"
       FROM "provider" p
       WHERE p."id" = $1 AND p."owner" = $2 AND p."lifecycleStatus" = 'active'
       FOR UPDATE OF p`,
    [providerId, userId],
  );
  if (!providerResult.rows[0]) return { outcome: `invalid` };

  const embedderResult = await executor.query<{ provider: string }>(`SELECT "provider" FROM "providerEmbedder" WHERE "provider" = $1 FOR UPDATE`, [providerId]);
  if (!embedderResult.rows[0]) return { outcome: `invalid` };

  const existingResult = await executor.query<{ enabled: boolean; provider: string }>(`SELECT "provider", "enabled" FROM "loopHistoryRag" WHERE "loop" = $1 FOR UPDATE`, [loopId]);
  const existing = existingResult.rows[0];
  if (existing?.enabled && existing.provider === providerId) return { outcome: `unchanged` };

  const result = await executor.query<{ generation: string }>(
    `INSERT INTO "loopHistoryRag" ("loop", "provider", "enabled", "status", "failureMessage", "embeddingDimensions")
     VALUES ($1, $2, TRUE, 'indexing', NULL, NULL)
     ON CONFLICT ("loop") DO UPDATE SET
       "provider" = EXCLUDED."provider", "generation" = uuidv7(), "enabled" = TRUE,
       "status" = 'indexing', "failureMessage" = NULL, "embeddingDimensions" = NULL
     RETURNING "generation"`,
    [loopId, providerId],
  );
  const generation = result.rows[0]?.generation;
  if (!generation) throw new Error(`Loop history memory generation was not created.`);
  await executor.query(`DELETE FROM "loopHistoryRagEntry" WHERE "loop" = $1`, [loopId]);
  return { outcome: `rebuild`, generation };
};

const queryEmbedder = async (loopId: string, generation?: string): Promise<LoopMemoryEmbedder | undefined> => {
  const result = await query<EmbedderRow>(
    `SELECT p."providerType", p."baseUrl", p."credentialCiphertext", p."credentialIv", p."credentialAuthTag", p."credentialKeyVersion", pe."model",
            lhr."generation", lhr."embeddingDimensions"
     FROM "loopHistoryRag" lhr
     JOIN "providerEmbedder" pe ON pe."provider" = lhr."provider"
     JOIN "provider" p ON p."id" = pe."provider" AND p."lifecycleStatus" = 'active'
     WHERE lhr."loop" = $1 AND lhr."enabled" = TRUE AND ($2::uuid IS NULL OR lhr."generation" = $2)`,
    [loopId, generation ?? null],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    generation: row.generation,
    embeddingDimensions: row.embeddingDimensions,
    connection: {
      providerType: row.providerType,
      baseUrl: row.baseUrl,
      model: row.model,
      apiKey: decryptSecret({ ciphertext: row.credentialCiphertext, iv: row.credentialIv, authTag: row.credentialAuthTag, keyVersion: row.credentialKeyVersion }),
    },
  };
};

const queryLoopMemoryEnabled = async (loopId: string): Promise<boolean> => {
  const result = await query(`SELECT 1 FROM "loopHistoryRag" WHERE "loop" = $1 AND "enabled" = TRUE`, [loopId]);
  return (result.rowCount ?? 0) > 0;
};

const serializeHistoryItem = (source: HistorySourceItem): string => JSON.stringify({ ...source.item, loop: source.loop, task: source.task, queueItem: source.queueItem, source: source.source, occurredAt: source.occurredAt });

const queryHistoryItems = async (loopId: string, taskId?: string, queueItemId?: string): Promise<HistorySourceItem[]> => {
  const result = await query<HistorySourceItem>(
    `SELECT t."loop", t."id" AS "task", item->>'id' AS "queueItem", history."source", item->>'timestamp' AS "occurredAt", item
     FROM "task" t
     CROSS JOIN LATERAL (
       SELECT 'queue'::text AS "source", item FROM jsonb_array_elements(t."queue") item
       UNION ALL
       SELECT 'archive'::text AS "source", item FROM jsonb_array_elements(t."queueArchive") item
     ) history
     WHERE t."loop" = $1
       AND item ? 'id'
       AND item ? 'timestamp'
       AND ($2::uuid IS NULL OR t."id" = $2)
       AND ($3::uuid IS NULL OR item->>'id' = $3::text)
     ORDER BY item->>'timestamp', t."id", item->>'id'`,
    [loopId, taskId ?? null, queueItemId ?? null],
  );
  return result.rows;
};

const persistEmbeddedItems = async (loopId: string, items: HistorySourceItem[], options: { generation?: string; signal?: AbortSignal; updateExisting: boolean }): Promise<boolean> => {
  if (items.length === 0) return true;
  options.signal?.throwIfAborted();
  const embedder = await queryEmbedder(loopId, options.generation);
  if (!embedder) return false;
  const texts = items.map(serializeHistoryItem);
  options.signal?.throwIfAborted();
  const vectors = await new ProviderEmbedder(embedder.connection).embed(texts);
  options.signal?.throwIfAborted();
  if (!(await queryEmbedder(loopId, embedder.generation))) return false;
  const dimensions = vectors[0]?.length;
  if (!dimensions) throw new Error(`Loop history embedding returned no dimensions.`);
  if (embedder.embeddingDimensions !== null && embedder.embeddingDimensions !== dimensions) {
    throw new Error(`Loop history embedding dimensions changed from ${embedder.embeddingDimensions} to ${dimensions}.`);
  }

  const values: unknown[] = [];
  const tuples: string[] = [];
  for (const [index, item] of items.entries()) {
    const vector = vectors[index];
    if (!vector || vector.length !== dimensions) throw new Error(`Loop history embeddings have inconsistent dimensions.`);
    const offset = values.length;
    values.push(loopId, item.task, item.queueItem, item.source, item.occurredAt, texts[index], JSON.stringify(item.item), JSON.stringify(vector));
    tuples.push(`($${offset + 1}::uuid, $${offset + 2}::uuid, $${offset + 3}::uuid, $${offset + 4}::text, $${offset + 5}::timestamptz, $${offset + 6}::text, $${offset + 7}::jsonb, $${offset + 8}::vector)`);
  }

  const generationParameter = values.length + 1;
  const dimensionsParameter = values.length + 2;
  values.push(embedder.generation, dimensions);
  const conflictAction = options.updateExisting
    ? `DO UPDATE SET
       "source" = EXCLUDED."source", "occurredAt" = EXCLUDED."occurredAt", "text" = EXCLUDED."text", "provenance" = EXCLUDED."provenance", "embedding" = EXCLUDED."embedding"`
    : `DO NOTHING`;
  const result = await query<{ relevant: boolean }>(
    `WITH current AS (
       UPDATE "loopHistoryRag"
       SET "embeddingDimensions" = COALESCE("embeddingDimensions", $${dimensionsParameter})
       WHERE "loop" = $1 AND "generation" = $${generationParameter} AND "enabled" = TRUE
         AND ("embeddingDimensions" IS NULL OR "embeddingDimensions" = $${dimensionsParameter})
       RETURNING "loop"
     ), inserted AS (
       INSERT INTO "loopHistoryRagEntry" ("loop", "task", "queueItem", "source", "occurredAt", "text", "provenance", "embedding")
       SELECT batch.* FROM (VALUES ${tuples.join(`, `)}) AS batch("loop", "task", "queueItem", "source", "occurredAt", "text", "provenance", "embedding")
       JOIN current ON current."loop" = batch."loop"
       ON CONFLICT ("loop", "task", "queueItem") ${conflictAction}
       RETURNING 1
     )
     SELECT EXISTS(SELECT 1 FROM current) AS "relevant"`,
    values,
  );
  return result.rows[0]?.relevant === true;
};

export const indexLoopMemoryBackfill = async (loopId: string, generation: string, signal?: AbortSignal): Promise<void> => {
  signal?.throwIfAborted();
  const started = await query(`UPDATE "loopHistoryRag" SET "status" = 'indexing', "failureMessage" = NULL WHERE "loop" = $1 AND "generation" = $2 AND "enabled" = TRUE`, [loopId, generation]);
  if ((started.rowCount ?? 0) === 0) return;
  try {
    const items = await queryHistoryItems(loopId);
    for (let index = 0; index < items.length; index += 50) {
      signal?.throwIfAborted();
      if (!(await persistEmbeddedItems(loopId, items.slice(index, index + 50), { generation, signal, updateExisting: false }))) return;
    }
    signal?.throwIfAborted();
    await query(`UPDATE "loopHistoryRag" SET "status" = 'ready', "failureMessage" = NULL WHERE "loop" = $1 AND "generation" = $2 AND "enabled" = TRUE`, [loopId, generation]);
  } catch (error) {
    if (signal?.aborted) throw error;
    const message = error instanceof Error ? error.message : String(error);
    await query(`UPDATE "loopHistoryRag" SET "status" = 'failed', "failureMessage" = $3 WHERE "loop" = $1 AND "generation" = $2 AND "enabled" = TRUE`, [loopId, generation, message]);
    throw error;
  }
};

export const indexLoopMemoryItem = async (loopId: string, taskId: string, queueItemId?: string, signal?: AbortSignal): Promise<void> => {
  signal?.throwIfAborted();
  if (!(await queryLoopMemoryEnabled(loopId))) return;
  await persistEmbeddedItems(loopId, await queryHistoryItems(loopId, taskId, queueItemId), { signal, updateExisting: true });
};

export const lookupLoopMemory = async (loopId: string, queryText: string, limit: number): Promise<Array<{ text: string; occurredAt: string; provenance: Record<string, unknown> }>> => {
  const embedder = await queryEmbedder(loopId);
  if (!embedder) throw new Error(`Loop history memory is not enabled or its embedding provider is unavailable.`);
  const [vector] = await new ProviderEmbedder(embedder.connection).embed([queryText]);
  if (!vector) return [];
  const result = await query<{ text: string; occurredAt: string; provenance: Record<string, unknown> }>(
    `SELECT entry."text", entry."occurredAt", entry."provenance"
     FROM "loopHistoryRagEntry" entry
     JOIN "loopHistoryRag" memory ON memory."loop" = entry."loop"
       AND memory."generation" = $4 AND memory."enabled" = TRUE
     WHERE entry."loop" = $1
     ORDER BY entry."embedding" <=> $2::vector, entry."occurredAt", entry."id"
     LIMIT $3`,
    [loopId, JSON.stringify(vector), limit, embedder.generation],
  );
  return result.rows;
};
