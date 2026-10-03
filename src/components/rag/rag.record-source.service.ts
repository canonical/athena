import { type QueryExecutor, query } from "@components/postgres/postgres.js";
import { taskQueueItemSchema } from "@components/task/task.schema.js";
import type { RagBuildSourceRecord, RagRecordProjection, RagRecordProjectionReference, RagRecordSourceWrite } from "./rag.schema.js";

const projectionPageSize = 100;

export const queryRagRecordSourceInsert = async (executor: QueryExecutor, source: RagRecordSourceWrite): Promise<RagRecordProjectionReference[]> => {
  const result = await executor.query<RagRecordProjectionReference>(
    `WITH targetIndexes AS (
       SELECT "id"
       FROM "ragIndex"
       WHERE "kind" = 'loopActivity'
         AND "sourceRef" = $1::text
         AND "lifecycleStatus" IN ('rebuilding', 'ready')
       FOR KEY SHARE
     ), insertedSource AS (
       INSERT INTO "ragRecordSource" (
         "loop", "sourceType", "sourceId", "recordKind", "logicalRef", "text", "provenance",
         "contentHash", "originalByteCount", "truncated", "occurredAt"
       )
      SELECT $1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11
       WHERE EXISTS (SELECT 1 FROM targetIndexes)
       ON CONFLICT ("sourceType", "sourceId") DO NOTHING
       RETURNING "id", "loop"
     ), sourceRecord AS (
       SELECT "id", "loop" FROM insertedSource
       UNION ALL
       SELECT source."id", source."loop"
       FROM "ragRecordSource" source
       WHERE source."sourceType" = $2
         AND source."sourceId" = $3
         AND EXISTS (SELECT 1 FROM targetIndexes)
         AND NOT EXISTS (SELECT 1 FROM insertedSource)
     ), insertedProjection AS (
       INSERT INTO "ragRecordProjection" ("ragIndex", "ragRecordSource")
       SELECT target."id", source."id"
       FROM sourceRecord source
       CROSS JOIN targetIndexes target
       ON CONFLICT ("ragIndex", "ragRecordSource") DO NOTHING
       RETURNING "id", "ragIndex", "ragRecordSource"
     ), counts AS (
       SELECT "ragIndex", COUNT(*)::integer AS "count"
       FROM insertedProjection
       GROUP BY "ragIndex"
     ), updated AS (
       UPDATE "ragIndex" ri
       SET "sourceCount" = ri."sourceCount" + counts."count",
           "pendingCount" = ri."pendingCount" + counts."count"
       FROM counts
       WHERE ri."id" = counts."ragIndex"
       RETURNING ri."id"
     )
     SELECT projection."id", projection."ragIndex", projection."ragRecordSource"
     FROM insertedProjection projection
     JOIN updated ON updated."id" = projection."ragIndex"`,
    [source.loop, source.sourceType, source.sourceId, source.recordKind, source.logicalRef, source.text, JSON.stringify(source.provenance), source.contentHash, source.originalByteCount, source.truncated, source.occurredAt],
  );

  return result.rows;
};

export const queryRagBuildSourcePage = async (ragIndexId: string, afterTaskId?: string, afterTaskOrdinal = 0): Promise<RagBuildSourceRecord[]> => {
  const result = await query<{ loop: string; task: string; taskTitle: string | null; queueItem: unknown; taskOrdinal: string }>(
    `SELECT task."loop", task."id" AS "task", task."title" AS "taskTitle", item.value AS "queueItem", item.ordinality AS "taskOrdinal"
     FROM "ragIndex" ri
     JOIN "task" task ON task."loop"::text = ri."sourceRef"
     CROSS JOIN LATERAL jsonb_array_elements(task."queueArchive" || task."queue") WITH ORDINALITY AS item(value, ordinality)
     WHERE ri."id" = $1
       AND ri."kind" = 'loopActivity'
       AND ri."lifecycleStatus" = 'rebuilding'
       AND item.value->>'type' = 'message'
       AND ($2::uuid IS NULL OR (task."id", item.ordinality) > ($2::uuid, $3::bigint))
     ORDER BY task."id", item.ordinality
     LIMIT $4`,
    [ragIndexId, afterTaskId ?? null, afterTaskOrdinal, projectionPageSize],
  );

  return result.rows.map((record) => ({ ...record, queueItem: taskQueueItemSchema.parse(record.queueItem), taskOrdinal: Number(record.taskOrdinal) }));
};

export const queryRagBuildProjectionPage = async (ragIndexId: string): Promise<number> => {
  const result = await query<{ count: number }>(
    `WITH targetIndex AS (
       SELECT "id", "sourceRef"
       FROM "ragIndex"
       WHERE "id" = $1 AND "kind" = 'loopActivity' AND "lifecycleStatus" = 'rebuilding'
     ), candidates AS (
       SELECT source."id"
       FROM targetIndex target
       JOIN "ragRecordSource" source ON source."loop"::text = target."sourceRef"
       LEFT JOIN "ragRecordProjection" projection
         ON projection."ragIndex" = target."id" AND projection."ragRecordSource" = source."id"
       WHERE projection."id" IS NULL
       ORDER BY source."occurredAt", source."id"
       LIMIT $2
     ), inserted AS (
       INSERT INTO "ragRecordProjection" ("ragIndex", "ragRecordSource")
       SELECT $1, candidates."id"
       FROM candidates
       ON CONFLICT ("ragIndex", "ragRecordSource") DO NOTHING
       RETURNING "id"
     ), counted AS (
       SELECT COUNT(*)::integer AS "count" FROM inserted
     ), updated AS (
       UPDATE "ragIndex"
       SET "sourceCount" = "sourceCount" + counted."count",
           "pendingCount" = "pendingCount" + counted."count"
       FROM counted
       WHERE "id" = $1 AND counted."count" > 0
     )
     SELECT "count" FROM counted`,
    [ragIndexId, projectionPageSize],
  );

  return result.rows[0]?.count ?? 0;
};

export const queryRagBuildScanComplete = async (ragIndexId: string): Promise<void> => {
  await query(
    `UPDATE "ragIndex"
     SET "rebuildScannedAt" = NOW(),
         "lifecycleStatus" = CASE WHEN "pendingCount" = 0 THEN 'ready' ELSE "lifecycleStatus" END,
         "rebuildCompletedAt" = CASE WHEN "pendingCount" = 0 THEN NOW() ELSE "rebuildCompletedAt" END
     WHERE "id" = $1 AND "lifecycleStatus" = 'rebuilding'`,
    [ragIndexId],
  );
};

export const queryPendingRagRecordProjections = async (ragIndexId?: string, afterId?: string): Promise<RagRecordProjectionReference[]> => {
  const result = await query<RagRecordProjectionReference>(
    `SELECT projection."id", projection."ragIndex", projection."ragRecordSource"
     FROM "ragRecordProjection" projection
     JOIN "ragIndex" ri ON ri."id" = projection."ragIndex"
     WHERE projection."status" = 'pending'
       AND ri."lifecycleStatus" IN ('rebuilding', 'ready')
       AND ($1::uuid IS NULL OR projection."ragIndex" = $1)
       AND ($2::uuid IS NULL OR projection."id" > $2)
     ORDER BY projection."id"
     LIMIT $3`,
    [ragIndexId ?? null, afterId ?? null, projectionPageSize],
  );
  return result.rows;
};

export const queryRagRecordProjection = async (projectionId: string): Promise<RagRecordProjection | null> => {
  const result = await query<RagRecordProjection>(
    `SELECT projection."id", projection."ragIndex", projection."ragRecordSource", projection."status", projection."error",
            source."recordKind" AS "sourceKind", source."sourceType", source."sourceId", source."logicalRef",
            source."text", source."provenance", source."occurredAt"
     FROM "ragRecordProjection" projection
     JOIN "ragRecordSource" source ON source."id" = projection."ragRecordSource"
     JOIN "ragIndex" ri ON ri."id" = projection."ragIndex"
     WHERE projection."id" = $1 AND ri."lifecycleStatus" IN ('rebuilding', 'ready')`,
    [projectionId],
  );
  return result.rows[0] ?? null;
};

export const queryRagRecordProjectionProjected = async (projectionId: string): Promise<void> => {
  await query(
    `WITH projected AS (
       UPDATE "ragRecordProjection"
       SET "status" = 'projected', "error" = NULL
       WHERE "id" = $1 AND "status" <> 'projected'
       RETURNING "ragIndex"
     )
     UPDATE "ragIndex" ri
     SET "pendingCount" = GREATEST(ri."pendingCount" - 1, 0),
         "projectedCount" = ri."projectedCount" + 1,
         "lifecycleStatus" = CASE
           WHEN ri."lifecycleStatus" = 'rebuilding' AND ri."pendingCount" <= 1 AND ri."rebuildScannedAt" IS NOT NULL THEN 'ready'
           ELSE ri."lifecycleStatus"
         END,
         "rebuildCompletedAt" = CASE
           WHEN ri."lifecycleStatus" = 'rebuilding' AND ri."pendingCount" <= 1 AND ri."rebuildScannedAt" IS NOT NULL THEN NOW()
           ELSE ri."rebuildCompletedAt"
         END
     FROM projected
     WHERE ri."id" = projected."ragIndex"`,
    [projectionId],
  );
};

export const queryRagRecordProjectionFailed = async (projectionId: string, error: string): Promise<void> => {
  await query(
    `WITH failed AS (
       UPDATE "ragRecordProjection"
       SET "status" = 'failed', "error" = $2
       WHERE "id" = $1 AND "status" = 'pending'
       RETURNING "ragIndex"
     )
     UPDATE "ragIndex" ri
     SET "pendingCount" = GREATEST(ri."pendingCount" - 1, 0),
         "failedCount" = ri."failedCount" + 1,
         "lastError" = $2,
         "lifecycleStatus" = CASE WHEN ri."lifecycleStatus" = 'rebuilding' THEN 'failed' ELSE ri."lifecycleStatus" END
     FROM failed
     WHERE ri."id" = failed."ragIndex"`,
    [projectionId, error],
  );
};

export const queryRagIndexBuildFailed = async (ragIndexId: string, error: string): Promise<void> => {
  await query(`UPDATE "ragIndex" SET "lifecycleStatus" = 'failed', "lastError" = $2 WHERE "id" = $1 AND "lifecycleStatus" = 'rebuilding'`, [ragIndexId, error]);
};

export const ragRecordProjectionPageSize = projectionPageSize;
