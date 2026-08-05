import { getPool } from "@components/postgres/postgres.js";
import type { LoopReadinessCounts } from "./loop.readiness.js";
import type { Loop, LoopInsert, LoopUpdate, ProviderSelectionPolicy, ProviderSelectionPolicyUpdate } from "./loop.schema.js";

const loopColumns = `"id", "name", "description", "iterationCostLimitUsd", "createdAt", "updatedAt"`;
const loopSelectColumns = `l."id", l."name", l."description", l."iterationCostLimitUsd", l."createdAt", l."updatedAt"`;

export const queryLoopById = async (loopId: string): Promise<Loop | undefined> => {
  const result = await getPool().query<Loop>(
    `
      SELECT ${loopSelectColumns}
      FROM "loop" l
      WHERE l."id" = $1
      LIMIT 1
    `,
    [loopId],
  );

  return result.rows[0];
};

export const queryLoopForUser = async (loopId: string, userId: string): Promise<Loop | undefined> => {
  const result = await getPool().query<Loop>(
    `
      SELECT ${loopSelectColumns}
      FROM "loop" l
      JOIN "loopUser" lu ON lu."loop" = l."id"
      WHERE l."id" = $1
        AND lu."user" = $2
    `,
    [loopId, userId],
  );

  return result.rows[0];
};

export const queryLoopMembership = async (loopId: string, userId: string): Promise<boolean> => {
  const result = await getPool().query(`SELECT 1 FROM "loopUser" WHERE "loop" = $1 AND "user" = $2`, [loopId, userId]);

  return Boolean(result.rowCount);
};

export const queryLoopAdminMembership = async (loopId: string, userId: string): Promise<boolean> => {
  const result = await getPool().query(`SELECT 1 FROM "loopUser" WHERE "loop" = $1 AND "user" = $2 AND "isAdmin" = TRUE`, [loopId, userId]);

  return Boolean(result.rowCount);
};

export const queryLoopList = async (userId: string): Promise<Loop[]> => {
  const result = await getPool().query<Loop>(
    `
      SELECT ${loopSelectColumns}
      FROM "loop" l
      JOIN "loopUser" lu ON lu."loop" = l."id"
      WHERE lu."user" = $1
      ORDER BY l."updatedAt" DESC, l."createdAt" DESC
    `,
    [userId],
  );

  return result.rows;
};

export const queryLoopCreate = async (input: LoopInsert, userId: string): Promise<Loop> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);

    const result = await client.query<Loop>(
      `
        INSERT INTO "loop" ("name", "description", "iterationCostLimitUsd")
        VALUES ($1, $2, $3)
        RETURNING ${loopColumns}
      `,
      [input.name, input.description ?? null, input.iterationCostLimitUsd ?? null],
    );

    const loop = result.rows[0];

    if (!loop) {
      throw new Error(`Loop was not created.`);
    }

    await client.query(`INSERT INTO "loopUser" ("loop", "user", "isAdmin") VALUES ($1, $2, TRUE)`, [loop.id, userId]);
    await client.query(
      `INSERT INTO "loopPersona" ("loop", "persona")
       SELECT $1, "id" FROM "persona" WHERE "isDefault" = TRUE
       ON CONFLICT DO NOTHING`,
      [loop.id],
    );
    await client.query(`COMMIT`);

    return loop;
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

export const queryLoopUpdate = async (loopId: string, input: LoopUpdate, userId: string): Promise<Loop | undefined> => {
  const result = await getPool().query<Loop>(
    `
      UPDATE "loop" AS l
      SET
        "name" = $1,
        "description" = $2,
        "iterationCostLimitUsd" = $3
      FROM "loopUser" AS lu
      WHERE l."id" = $4
        AND lu."loop" = l."id"
        AND lu."user" = $5
       AND lu."isAdmin" = TRUE
      RETURNING l."id", l."name", l."description", l."iterationCostLimitUsd", l."createdAt", l."updatedAt"
    `,
    [input.name, input.description ?? null, input.iterationCostLimitUsd ?? null, loopId, userId],
  );

  return result.rows[0];
};

export const queryLoopDelete = async (loopId: string, userId: string): Promise<boolean> => {
  const result = await getPool().query(
    `
      DELETE FROM "loop" AS l
      USING "loopUser" AS lu
      WHERE l."id" = $1
        AND lu."loop" = l."id"
        AND lu."user" = $2
        AND lu."isAdmin" = TRUE
    `,
    [loopId, userId],
  );

  return Boolean(result.rowCount);
};

export const queryLoopProviderSelectionPolicy = async (loopId: string, userId: string): Promise<ProviderSelectionPolicy | undefined> => {
  const result = await getPool().query<ProviderSelectionPolicy>(
    `
      SELECT
        l."id" AS "loop",
        l."providerSelectionAlgorithm",
        l."providerSelectionCursor",
        l."runnerSelectionAlgorithm",
        l."runnerSelectionCursor",
        l."updatedAt"
      FROM "loop" l
      JOIN "loopUser" lu ON lu."loop" = l."id"
      WHERE l."id" = $1
        AND lu."user" = $2
    `,
    [loopId, userId],
  );

  return result.rows[0];
};

export const queryLoopProviderSelectionPolicyUpdate = async (loopId: string, userId: string, input: ProviderSelectionPolicyUpdate): Promise<ProviderSelectionPolicy | undefined> => {
  const result = await getPool().query<ProviderSelectionPolicy>(
    `
      UPDATE "loop" AS l
      SET
        "providerSelectionAlgorithm" = COALESCE($1, l."providerSelectionAlgorithm"),
        "runnerSelectionAlgorithm" = COALESCE($2, l."runnerSelectionAlgorithm")
      FROM "loopUser" AS lu
      WHERE l."id" = $3
        AND lu."loop" = l."id"
        AND lu."user" = $4
        AND lu."isAdmin" = TRUE
      RETURNING
        l."id" AS "loop",
        l."providerSelectionAlgorithm",
        l."providerSelectionCursor",
        l."runnerSelectionAlgorithm",
        l."runnerSelectionCursor",
        l."updatedAt"
    `,
    [input.providerSelectionAlgorithm ?? null, input.runnerSelectionAlgorithm ?? null, loopId, userId],
  );

  return result.rows[0];
};

export const queryLoopReadinessCounts = async (loopId: string): Promise<LoopReadinessCounts> => {
  const result = await getPool().query<{
    activeRoutingPersonaCount: string;
    activeExecutionPersonaCount: string;
    activeProviderCount: string;
    activeProviderWithModelConfigCount: string;
    activeProviderMissingModelConfigCount: string;
    activeRunnerCount: string;
    activeWorkgraphCount: string;
  }>(
    `
      SELECT
        (
          SELECT COUNT(*)::text
          FROM "loopPersona" lp
          JOIN "persona" p ON p."id" = lp."persona"
          WHERE lp."loop" = $1
            AND p."lifecycleStatus" = 'active'
            AND p."isRouting" = TRUE
        ) AS "activeRoutingPersonaCount",
        (
          SELECT COUNT(*)::text
          FROM "loopPersona" lp
          JOIN "persona" p ON p."id" = lp."persona"
          WHERE lp."loop" = $1
            AND p."lifecycleStatus" = 'active'
            AND p."isRouting" = FALSE
        ) AS "activeExecutionPersonaCount",
        (
          SELECT COUNT(*)::text
          FROM "loopProvider" lp
          JOIN "provider" p ON p."id" = lp."provider"
          WHERE lp."loop" = $1
            AND lp."enabled" = TRUE
            AND p."lifecycleStatus" = 'active'
            AND p."providerType" = 'openrouter'
        ) AS "activeProviderCount",
        (
          SELECT COUNT(*)::text
          FROM "loopProvider" lp
          JOIN "provider" p ON p."id" = lp."provider"
          WHERE lp."loop" = $1
            AND lp."enabled" = TRUE
            AND p."lifecycleStatus" = 'active'
            AND p."providerType" = 'openrouter'
            AND COALESCE(NULLIF(BTRIM(p."defaultModel"), ''), NULL) IS NOT NULL
            AND COALESCE(array_length(p."enabledModels", 1), 0) > 0
        ) AS "activeProviderWithModelConfigCount",
        (
          SELECT COUNT(*)::text
          FROM "loopProvider" lp
          JOIN "provider" p ON p."id" = lp."provider"
          WHERE lp."loop" = $1
            AND lp."enabled" = TRUE
            AND p."lifecycleStatus" = 'active'
            AND p."providerType" = 'openrouter'
            AND (
              COALESCE(NULLIF(BTRIM(p."defaultModel"), ''), NULL) IS NULL
              OR COALESCE(array_length(p."enabledModels", 1), 0) = 0
            )
        ) AS "activeProviderMissingModelConfigCount",
        (
          SELECT COUNT(*)::text
          FROM "loopRunner" lr
          JOIN "runner" r ON r."id" = lr."runner"
          WHERE lr."loop" = $1
            AND lr."enabled" = TRUE
            AND r."lifecycleStatus" = 'active'
            AND r."runnerType" = 'github-copilot-cloud'
        ) AS "activeRunnerCount",
        (
          SELECT COUNT(*)::text
          FROM "loopWorkgraph" lw
          JOIN "workgraph" w ON w."id" = lw."workgraph"
          WHERE lw."loop" = $1
            AND lw."enabled" = TRUE
            AND w."lifecycleStatus" = 'active'
            AND w."type" = 'jira'
        ) AS "activeWorkgraphCount"
    `,
    [loopId],
  );

  const row = result.rows[0];

  return {
    activeRoutingPersonaCount: Number(row?.activeRoutingPersonaCount ?? `0`),
    activeExecutionPersonaCount: Number(row?.activeExecutionPersonaCount ?? `0`),
    activeProviderCount: Number(row?.activeProviderCount ?? `0`),
    activeProviderWithModelConfigCount: Number(row?.activeProviderWithModelConfigCount ?? `0`),
    activeProviderMissingModelConfigCount: Number(row?.activeProviderMissingModelConfigCount ?? `0`),
    activeRunnerCount: Number(row?.activeRunnerCount ?? `0`),
    activeWorkgraphCount: Number(row?.activeWorkgraphCount ?? `0`),
  };
};
