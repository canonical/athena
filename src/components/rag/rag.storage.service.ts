import type { QueryExecutor } from "@components/postgres/postgres.js";
import { RagExecutionError } from "./rag.errors.js";
import type { RagEntryLookup, RagEntryWrite, RagLookupHit } from "./rag.schema.js";

const vectorLiteral = (embedding: number[]): string => {
  if (embedding.length === 0 || embedding.some((coordinate) => !Number.isFinite(coordinate))) {
    throw new RagExecutionError(`RAG embeddings must contain finite coordinates.`);
  }

  return JSON.stringify(embedding);
};

export const ragEntryUpsert = async (executor: QueryExecutor, entries: RagEntryWrite[]): Promise<void> => {
  for (const entry of entries) {
    const result = await executor.query<{ id: string }>(
      `WITH writableIndex AS (
         UPDATE "ragIndex"
         SET "embeddingDimension" = COALESCE("embeddingDimension", vector_dims($10::vector))
         WHERE "id" = $1
           AND "lifecycleStatus" IN ('rebuilding', 'ready')
           AND ("embeddingDimension" IS NULL OR "embeddingDimension" = vector_dims($10::vector))
         RETURNING "id"
       )
       INSERT INTO "ragEntry" (
         "ragIndex", "sourceKind", "sourceRef", "logicalRef",
         "segmentKey", "segmentOrdinal", "text", "provenance", "occurredAt", "embedding"
       )
       SELECT $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::vector
       FROM writableIndex
       ON CONFLICT ("ragIndex", "sourceRef", "occurredAt", "segmentKey") DO UPDATE
       SET "sourceKind" = EXCLUDED."sourceKind",
           "logicalRef" = EXCLUDED."logicalRef",
           "segmentOrdinal" = EXCLUDED."segmentOrdinal",
           "text" = EXCLUDED."text",
           "provenance" = EXCLUDED."provenance",
           "embedding" = EXCLUDED."embedding",
           "supersededAt" = NULL
       RETURNING "id"`,
      [entry.ragIndex, entry.sourceKind, entry.sourceRef, entry.logicalRef, entry.segmentKey, entry.segmentOrdinal, entry.text, JSON.stringify(entry.provenance), entry.occurredAt, vectorLiteral(entry.embedding)],
    );

    if (!result.rows[0]) {
      throw new RagExecutionError(`RAG entry write rejected because the index is unavailable, not writable, or uses a different embedding dimension.`);
    }
  }
};

export const ragEntryLookup = async (input: RagEntryLookup): Promise<RagLookupHit[]> => {
  const limit = Math.max(1, Math.min(input.limit, 100));
  const result = await input.executor.query<RagLookupHit>(
    `WITH readableIndex AS MATERIALIZED (
       SELECT "id"
       FROM "ragIndex"
       WHERE "id" = $1
         AND "lifecycleStatus" = 'ready'
         AND "embeddingDimension" = vector_dims($2::vector)
     )
     SELECT
       entry."id", entry."sourceKind", entry."sourceRef", entry."logicalRef", entry."segmentKey", entry."segmentOrdinal",
       entry."text", entry."provenance", entry."occurredAt", 1 - (entry."embedding" <=> $2::vector) AS "similarity"
     FROM "ragEntry" entry
     JOIN readableIndex ON readableIndex."id" = entry."ragIndex"
     WHERE entry."embedding" IS NOT NULL
       AND entry."supersededAt" IS NULL
     ORDER BY entry."embedding" <=> $2::vector, entry."sourceRef", entry."segmentOrdinal", entry."id"
     LIMIT $3`,
    [input.ragIndex, vectorLiteral(input.embedding), limit],
  );

  return result.rows;
};
