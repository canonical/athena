import { getPool } from "@components/postgres/postgres.js";
import type { LoopProviderDeleteResult, ProviderDeleteResult, ProviderUsingRagIndex } from "@components/provider/provider.schema.js";
import type { PoolClient } from "pg";
import type { RagIndex, RagIndexConfigure, RagIndexConfigureResult } from "./rag.schema.js";

const ragIndexColumns = `ri."id", ri."provider", p."displayName" AS "providerDisplayName", ri."embeddingModel", ri."embeddingDimension", ri."sourceStrategy", ri."sourceRef", ri."segmentationStrategy", ri."lifecycleStatus", ri."sourceCount", ri."pendingCount", ri."projectedCount", ri."skippedCount", ri."failedCount", ri."lastError", ri."rebuildStartedAt", ri."rebuildCompletedAt", ri."createdAt", ri."updatedAt"`;
const ragIndexRelations = `JOIN "provider" p ON p."id" = ri."provider"`;
const loopActivitySource = `loopActivity`;
const wholeEntrySegmentation = `wholeEntry`;

const runTransaction = async <Result>(operation: (client: PoolClient) => Promise<Result>): Promise<Result> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);
    const result = await operation(client);
    await client.query(`COMMIT`);
    return result;
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

const lockTransactionKey = async (client: PoolClient, key: string): Promise<void> => {
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [key]);
};

export const queryLoopDelete = async (loopId: string, userId: string): Promise<boolean> =>
  runTransaction(async (client) => {
    await lockTransactionKey(client, loopId);
    const authorized = await client.query(
      `SELECT l."id"
       FROM "loop" l
       JOIN "loopUser" lu ON lu."loop" = l."id"
       WHERE l."id" = $1
         AND lu."user" = $2
         AND lu."isAdmin" = TRUE
       FOR UPDATE OF l`,
      [loopId, userId],
    );

    if (!authorized.rows[0]) {
      return false;
    }

    await client.query(
      `DELETE FROM "ragIndex"
       WHERE "kind" = 'loopActivity'
         AND "sourceRef" = $1`,
      [loopId],
    );
    await client.query(`DELETE FROM "loop" WHERE "id" = $1`, [loopId]);
    return true;
  });

export const queryProviderDelete = async (providerId: string, ownerId: string): Promise<ProviderDeleteResult> =>
  runTransaction(async (client) => {
    const provider = await client.query(
      `SELECT "id"
       FROM "provider"
       WHERE "id" = $1 AND "owner" = $2
       FOR UPDATE`,
      [providerId, ownerId],
    );

    if (!provider.rows[0]) {
      return { status: `notFound` };
    }

    const usage = await client.query<ProviderUsingRagIndex>(
      `SELECT ri."id", CASE WHEN ri."kind" = 'loopActivity' THEN ri."sourceRef" END AS "loop"
       FROM "ragIndex" ri
       WHERE ri."provider" = $1
       ORDER BY ri."createdAt", ri."id"`,
      [providerId],
    );

    if (usage.rows.length > 0) {
      return { status: `inUse`, ragIndexes: usage.rows };
    }

    await client.query(`DELETE FROM "provider" WHERE "id" = $1`, [providerId]);
    return { status: `deleted` };
  });

export const queryLoopProviderDelete = async (loopId: string, providerId: string): Promise<LoopProviderDeleteResult> =>
  runTransaction(async (client) => {
    await lockTransactionKey(client, loopId);
    const assignment = await client.query(
      `SELECT "provider"
       FROM "loopProvider"
       WHERE "loop" = $1 AND "provider" = $2
       FOR UPDATE`,
      [loopId, providerId],
    );

    if (!assignment.rows[0]) {
      return { status: `notFound` };
    }

    const usage = await client.query<ProviderUsingRagIndex>(
      `SELECT ri."id", ri."sourceRef" AS "loop"
       FROM "ragIndex" ri
       WHERE ri."provider" = $1
         AND ri."kind" = 'loopActivity'
         AND ri."sourceRef" = $2
       ORDER BY ri."createdAt", ri."id"`,
      [providerId, loopId],
    );

    if (usage.rows.length > 0) {
      return { status: `inUse`, ragIndexes: usage.rows };
    }

    await client.query(`DELETE FROM "loopProvider" WHERE "loop" = $1 AND "provider" = $2`, [loopId, providerId]);
    return { status: `deleted` };
  });

export const queryRagIndexConfigure = async (loopId: string, userId: string, input: RagIndexConfigure): Promise<RagIndexConfigureResult> =>
  runTransaction(async (client) => {
    await lockTransactionKey(client, loopId);
    const loop = await client.query(
      `SELECT "id"
       FROM "loop"
       WHERE "id" = $1
       FOR SHARE`,
      [loopId],
    );

    if (!loop.rows[0]) {
      return { status: `notFound` };
    }

    const membership = await client.query<{ isAdmin: boolean }>(
      `SELECT "isAdmin"
       FROM "loopUser"
       WHERE "loop" = $1
         AND "user" = $2
       FOR SHARE`,
      [loopId, userId],
    );

    if (!membership.rows[0]) {
      return { status: `notFound` };
    }

    if (!membership.rows[0].isAdmin) {
      return { status: `forbidden` };
    }

    const assignment = await client.query(
      `SELECT lp."provider"
       FROM "loopProvider" lp
       JOIN "provider" p ON p."id" = lp."provider"
       WHERE lp."loop" = $1
         AND lp."provider" = $2
         AND lp."enabled" = TRUE
         AND p."lifecycleStatus" = 'active'
         AND $3 = ANY(COALESCE(p."embeddingEnabledModels", ARRAY[]::text[]))
       FOR KEY SHARE OF p`,
      [loopId, input.provider, input.embeddingModel],
    );

    if (!assignment.rows[0]) {
      return { status: `providerUnavailable` };
    }

    const existing = await client.query<RagIndex>(
      `SELECT ${ragIndexColumns}
       FROM "ragIndex" ri
       ${ragIndexRelations}
       WHERE ri."kind" = 'loopActivity'
         AND ri."sourceRef" = $1`,
      [loopId],
    );

    const current = existing.rows[0];
    if (current?.provider === input.provider && current.embeddingModel === input.embeddingModel) {
      return { status: `configured`, index: current };
    }

    if (current && current.lifecycleStatus !== `disabled`) {
      return { status: `active` };
    }

    const indexResult = await client.query<{ id: string }>(
      `INSERT INTO "ragIndex" ("kind", "sourceStrategy", "sourceRef", "segmentationStrategy", "provider", "embeddingModel")
       VALUES ('loopActivity', $1, $2, $3, $4, $5)
       RETURNING "id"`,
      [loopActivitySource, loopId, wholeEntrySegmentation, input.provider, input.embeddingModel],
    );
    const indexId = indexResult.rows[0]?.id;
    if (!indexId) {
      throw new Error(`Failed to create RAG index.`);
    }

    if (current) {
      await client.query(`DELETE FROM "ragIndex" WHERE "id" = $1`, [current.id]);
    }

    const result = await client.query<RagIndex>(
      `SELECT ${ragIndexColumns}
       FROM "ragIndex" ri
       ${ragIndexRelations}
       WHERE ri."id" = $1`,
      [indexId],
    );
    const index = result.rows[0];
    if (!index) {
      throw new Error(`Failed to read configured RAG index.`);
    }
    return { status: `configured`, index };
  });
