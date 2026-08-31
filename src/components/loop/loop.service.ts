import { getPool, query } from "@components/postgres/postgres.js";
import type { LoopReadinessCounts } from "./loop.readiness.js";
import type { Loop, LoopInsert, LoopInvite, LoopMember, LoopUpdate, ProviderSelectionPolicy, ProviderSelectionPolicyUpdate } from "./loop.schema.js";

const loopColumns = `"id", "name", "description", "iterationCostLimitUsd", "createdAt", "updatedAt"`;
const loopSelectColumns = `l."id", l."name", l."description", l."iterationCostLimitUsd", l."createdAt", l."updatedAt"`;

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === `string` && entry.trim().length > 0).map((entry) => entry.trim())));
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const queryLoopById = async (loopId: string): Promise<Loop | undefined> => {
  const result = await query<Loop>(
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
  const result = await query<Loop>(
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
  const result = await query(`SELECT 1 FROM "loopUser" WHERE "loop" = $1 AND "user" = $2`, [loopId, userId]);

  return Boolean(result.rowCount);
};

export const queryLoopAdminMembership = async (loopId: string, userId: string): Promise<boolean> => {
  const result = await query(`SELECT 1 FROM "loopUser" WHERE "loop" = $1 AND "user" = $2 AND "isAdmin" = TRUE`, [loopId, userId]);

  return Boolean(result.rowCount);
};

export const queryLoopList = async (userId: string): Promise<Loop[]> => {
  const result = await query<Loop>(
    `
      SELECT ${loopSelectColumns}, lu."isAdmin" AS "currentUserIsAdmin"
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
  const result = await query<Loop>(
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

export const queryLoopProviderSelectionPolicy = async (loopId: string, userId: string): Promise<ProviderSelectionPolicy | undefined> => {
  const result = await query<ProviderSelectionPolicy>(
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
  const result = await query<ProviderSelectionPolicy>(
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

export const queryLoopDisabledProviderTools = async (loopId: string, userId: string): Promise<string[] | undefined> => {
  const result = await query<{ disabledProviderTools: unknown }>(
    `
      SELECT COALESCE(l."disabledProviderTools", '[]'::jsonb) AS "disabledProviderTools"
      FROM "loop" l
      JOIN "loopUser" lu ON lu."loop" = l."id"
      WHERE l."id" = $1
        AND lu."user" = $2
      LIMIT 1
    `,
    [loopId, userId],
  );

  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  return parseStringArray(row.disabledProviderTools);
};

export const queryLoopDisabledProviderToolsById = async (loopId: string): Promise<string[]> => {
  const result = await query<{ disabledProviderTools: unknown }>(
    `
      SELECT COALESCE("disabledProviderTools", '[]'::jsonb) AS "disabledProviderTools"
      FROM "loop"
      WHERE "id" = $1
      LIMIT 1
    `,
    [loopId],
  );

  return parseStringArray(result.rows[0]?.disabledProviderTools);
};

export const queryLoopDisabledProviderToolsUpdate = async (loopId: string, userId: string, disabledProviderTools: string[]): Promise<string[] | undefined> => {
  const result = await query<{ disabledProviderTools: unknown }>(
    `
      UPDATE "loop" AS l
      SET "disabledProviderTools" = $1::jsonb
      FROM "loopUser" AS lu
      WHERE l."id" = $2
        AND lu."loop" = l."id"
        AND lu."user" = $3
        AND lu."isAdmin" = TRUE
      RETURNING COALESCE(l."disabledProviderTools", '[]'::jsonb) AS "disabledProviderTools"
    `,
    [JSON.stringify(disabledProviderTools), loopId, userId],
  );

  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  return parseStringArray(row.disabledProviderTools);
};

export const queryLoopReadinessCounts = async (loopId: string): Promise<LoopReadinessCounts> => {
  const result = await query<{
    activeRoutingPersonaCount: string;
    activeExecutionPersonaCount: string;
    activeChatProviderCount: string;
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
            AND COALESCE(array_length(p."chatEnabledModels", 1), 0) > 0
        ) AS "activeChatProviderCount",
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
    activeChatProviderCount: Number(row?.activeChatProviderCount ?? `0`),
    activeRunnerCount: Number(row?.activeRunnerCount ?? `0`),
    activeWorkgraphCount: Number(row?.activeWorkgraphCount ?? `0`),
  };
};

export type LoopReadinessCountsRow = LoopReadinessCounts & {
  loopId: string;
};

export const queryLoopReadinessCountsAll = async (): Promise<LoopReadinessCountsRow[]> => {
  const result = await query<{
    loopId: string;
    activeRoutingPersonaCount: string;
    activeExecutionPersonaCount: string;
    activeChatProviderCount: string;
    activeRunnerCount: string;
    activeWorkgraphCount: string;
  }>(
    `
      SELECT
        l."id" AS "loopId",
        (
          SELECT COUNT(*)::text
          FROM "loopPersona" lp
          JOIN "persona" p ON p."id" = lp."persona"
          WHERE lp."loop" = l."id"
            AND p."lifecycleStatus" = 'active'
            AND p."isRouting" = TRUE
        ) AS "activeRoutingPersonaCount",
        (
          SELECT COUNT(*)::text
          FROM "loopPersona" lp
          JOIN "persona" p ON p."id" = lp."persona"
          WHERE lp."loop" = l."id"
            AND p."lifecycleStatus" = 'active'
            AND p."isRouting" = FALSE
        ) AS "activeExecutionPersonaCount",
        (
          SELECT COUNT(*)::text
          FROM "loopProvider" lp
          JOIN "provider" p ON p."id" = lp."provider"
          WHERE lp."loop" = l."id"
            AND lp."enabled" = TRUE
            AND p."lifecycleStatus" = 'active'
            AND p."providerType" = 'openrouter'
            AND COALESCE(array_length(p."chatEnabledModels", 1), 0) > 0
        ) AS "activeChatProviderCount",
        (
          SELECT COUNT(*)::text
          FROM "loopRunner" lr
          JOIN "runner" r ON r."id" = lr."runner"
          WHERE lr."loop" = l."id"
            AND lr."enabled" = TRUE
            AND r."lifecycleStatus" = 'active'
            AND r."runnerType" = 'github-copilot-cloud'
        ) AS "activeRunnerCount",
        (
          SELECT COUNT(*)::text
          FROM "loopWorkgraph" lw
          JOIN "workgraph" w ON w."id" = lw."workgraph"
          WHERE lw."loop" = l."id"
            AND lw."enabled" = TRUE
            AND w."lifecycleStatus" = 'active'
            AND w."type" = 'jira'
        ) AS "activeWorkgraphCount"
      FROM "loop" l
    `,
  );

  return result.rows.map((row) => ({
    loopId: row.loopId,
    activeRoutingPersonaCount: Number(row.activeRoutingPersonaCount ?? `0`),
    activeExecutionPersonaCount: Number(row.activeExecutionPersonaCount ?? `0`),
    activeChatProviderCount: Number(row.activeChatProviderCount ?? `0`),
    activeRunnerCount: Number(row.activeRunnerCount ?? `0`),
    activeWorkgraphCount: Number(row.activeWorkgraphCount ?? `0`),
  }));
};

export const queryLoopMemberList = async (loopId: string): Promise<LoopMember[]> => {
  const result = await query<LoopMember>(
    `
      SELECT
        lu."user",
        COALESCE(u."name", '') AS "name",
        COALESCE(u."picture", '') AS "picture",
        lu."isAdmin",
        lu."createdAt"
      FROM "loopUser" lu
      LEFT JOIN "user" u ON u."id" = lu."user"
      WHERE lu."loop" = $1
      ORDER BY lu."isAdmin" DESC, lu."createdAt" ASC, lu."user" ASC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryLoopPendingInviteList = async (loopId: string): Promise<LoopInvite[]> => {
  const result = await query<LoopInvite>(
    `
      SELECT
        li."id",
        li."loop",
        l."name" AS "loopName",
        li."invitedEmail",
        li."invitedBy",
        COALESCE(inviter."name", '') AS "invitedByName",
        li."acceptedBy",
        li."revokedBy",
        li."acceptedAt",
        li."revokedAt",
        li."createdAt",
        li."updatedAt"
      FROM "loopInvite" li
      JOIN "loop" l ON l."id" = li."loop"
      LEFT JOIN "user" inviter ON inviter."id" = li."invitedBy"
      WHERE li."loop" = $1
        AND li."acceptedAt" IS NULL
        AND li."revokedAt" IS NULL
      ORDER BY li."createdAt" DESC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryLoopInvitePendingForUser = async (userId: string): Promise<LoopInvite[]> => {
  const normalizedUserId = normalizeEmail(userId);
  const result = await query<LoopInvite>(
    `
      SELECT
        li."id",
        li."loop",
        l."name" AS "loopName",
        li."invitedEmail",
        li."invitedBy",
        COALESCE(inviter."name", '') AS "invitedByName",
        li."acceptedBy",
        li."revokedBy",
        li."acceptedAt",
        li."revokedAt",
        li."createdAt",
        li."updatedAt"
      FROM "loopInvite" li
      JOIN "loop" l ON l."id" = li."loop"
      LEFT JOIN "user" inviter ON inviter."id" = li."invitedBy"
      WHERE LOWER(li."invitedEmail") = $1
        AND li."acceptedAt" IS NULL
        AND li."revokedAt" IS NULL
      ORDER BY li."createdAt" DESC
    `,
    [normalizedUserId],
  );

  return result.rows;
};

export const queryLoopMemberByUserId = async (loopId: string, memberUserId: string): Promise<LoopMember | undefined> => {
  const result = await query<LoopMember>(
    `
      SELECT
        lu."user",
        COALESCE(u."name", '') AS "name",
        COALESCE(u."picture", '') AS "picture",
        lu."isAdmin",
        lu."createdAt"
      FROM "loopUser" lu
      LEFT JOIN "user" u ON u."id" = lu."user"
      WHERE lu."loop" = $1
        AND lu."user" = $2
      LIMIT 1
    `,
    [loopId, memberUserId],
  );

  return result.rows[0];
};

export const queryLoopMemberByEmail = async (loopId: string, email: string): Promise<LoopMember | undefined> => {
  const normalizedEmail = normalizeEmail(email);
  const result = await query<LoopMember>(
    `
      SELECT
        lu."user",
        COALESCE(u."name", '') AS "name",
        COALESCE(u."picture", '') AS "picture",
        lu."isAdmin",
        lu."createdAt"
      FROM "loopUser" lu
      LEFT JOIN "user" u ON u."id" = lu."user"
      WHERE lu."loop" = $1
        AND LOWER(lu."user") = $2
      LIMIT 1
    `,
    [loopId, normalizedEmail],
  );

  return result.rows[0];
};

export const queryLoopInviteCreate = async (loopId: string, invitedBy: string, invitedEmail: string): Promise<LoopInvite> => {
  const normalizedEmail = normalizeEmail(invitedEmail);

  const insertResult = await query<{ id: string }>(
    `
      INSERT INTO "loopInvite" ("loop", "invitedEmail", "invitedBy")
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
      RETURNING "id"
    `,
    [loopId, normalizedEmail, invitedBy],
  );

  const createdInviteId = insertResult.rows[0]?.id;

  if (createdInviteId) {
    const createdInvite = await queryLoopInviteById(createdInviteId);

    if (createdInvite) {
      return createdInvite;
    }
  }

  const existing = await query<LoopInvite>(
    `
      SELECT
        li."id",
        li."loop",
        l."name" AS "loopName",
        li."invitedEmail",
        li."invitedBy",
        COALESCE(inviter."name", '') AS "invitedByName",
        li."acceptedBy",
        li."revokedBy",
        li."acceptedAt",
        li."revokedAt",
        li."createdAt",
        li."updatedAt"
      FROM "loopInvite" li
      JOIN "loop" l ON l."id" = li."loop"
      LEFT JOIN "user" inviter ON inviter."id" = li."invitedBy"
      WHERE li."loop" = $1
        AND LOWER(li."invitedEmail") = $2
        AND li."acceptedAt" IS NULL
        AND li."revokedAt" IS NULL
      LIMIT 1
    `,
    [loopId, normalizedEmail],
  );

  const invite = existing.rows[0];

  if (!invite) {
    throw new Error(`Loop invite could not be created.`);
  }

  return invite;
};

export const queryLoopInviteById = async (inviteId: string): Promise<LoopInvite | undefined> => {
  const result = await query<LoopInvite>(
    `
      SELECT
        li."id",
        li."loop",
        l."name" AS "loopName",
        li."invitedEmail",
        li."invitedBy",
        COALESCE(inviter."name", '') AS "invitedByName",
        li."acceptedBy",
        li."revokedBy",
        li."acceptedAt",
        li."revokedAt",
        li."createdAt",
        li."updatedAt"
      FROM "loopInvite" li
      JOIN "loop" l ON l."id" = li."loop"
      LEFT JOIN "user" inviter ON inviter."id" = li."invitedBy"
      WHERE li."id" = $1
      LIMIT 1
    `,
    [inviteId],
  );

  return result.rows[0];
};

export const queryLoopInviteAccept = async (inviteId: string, userId: string): Promise<LoopInvite | undefined> => {
  const normalizedUser = normalizeEmail(userId);
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);

    const inviteResult = await client.query<{ id: string; loop: string; invitedEmail: string }>(
      `
        SELECT "id", "loop", "invitedEmail"
        FROM "loopInvite"
        WHERE "id" = $1
          AND "acceptedAt" IS NULL
          AND "revokedAt" IS NULL
        FOR UPDATE
      `,
      [inviteId],
    );

    const invite = inviteResult.rows[0];

    if (!invite) {
      await client.query(`ROLLBACK`);
      return undefined;
    }

    if (normalizeEmail(invite.invitedEmail) !== normalizedUser) {
      await client.query(`ROLLBACK`);
      return undefined;
    }

    await client.query(
      `
        INSERT INTO "loopUser" ("loop", "user", "isAdmin")
        VALUES ($1, $2, FALSE)
        ON CONFLICT ("loop", "user") DO NOTHING
      `,
      [invite.loop, userId],
    );

    await client.query(
      `
        UPDATE "loopInvite"
        SET
          "acceptedBy" = $2,
          "acceptedAt" = NOW()
        WHERE "id" = $1
      `,
      [inviteId, userId],
    );

    await client.query(`COMMIT`);

    return queryLoopInviteById(inviteId);
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

export const queryLoopInviteRevoke = async (loopId: string, inviteId: string, userId: string): Promise<boolean> => {
  const result = await query(
    `
      UPDATE "loopInvite"
      SET
        "revokedBy" = $3,
        "revokedAt" = NOW()
      WHERE "loop" = $1
        AND "id" = $2
        AND "acceptedAt" IS NULL
        AND "revokedAt" IS NULL
    `,
    [loopId, inviteId, userId],
  );

  return Boolean(result.rowCount);
};

export const queryLoopInviteReject = async (inviteId: string, userId: string): Promise<boolean> => {
  const normalizedUserId = normalizeEmail(userId);
  const result = await query(
    `
      UPDATE "loopInvite"
      SET
        "revokedBy" = $2,
        "revokedAt" = NOW()
      WHERE "id" = $1
        AND "acceptedAt" IS NULL
        AND "revokedAt" IS NULL
        AND LOWER("invitedEmail") = $3
    `,
    [inviteId, userId, normalizedUserId],
  );

  return Boolean(result.rowCount);
};

export const queryLoopAdminCount = async (loopId: string): Promise<number> => {
  const result = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS "count"
      FROM "loopUser"
      WHERE "loop" = $1
        AND "isAdmin" = TRUE
    `,
    [loopId],
  );

  return Number(result.rows[0]?.count ?? `0`);
};

export const queryLoopUserAdminUpdate = async (loopId: string, targetUser: string, changedBy: string, isAdmin: boolean): Promise<LoopMember | undefined> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);

    const memberResult = await client.query<{ user: string; isAdmin: boolean }>(
      `
        SELECT "user", "isAdmin"
        FROM "loopUser"
        WHERE "loop" = $1
          AND "user" = $2
        FOR UPDATE
      `,
      [loopId, targetUser],
    );

    const member = memberResult.rows[0];

    if (!member) {
      await client.query(`ROLLBACK`);
      return undefined;
    }

    if (member.isAdmin && !isAdmin) {
      const adminCountResult = await client.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS "count"
          FROM "loopUser"
          WHERE "loop" = $1
            AND "isAdmin" = TRUE
        `,
        [loopId],
      );

      if (Number(adminCountResult.rows[0]?.count ?? `0`) <= 1) {
        await client.query(`ROLLBACK`);
        return undefined;
      }
    }

    if (member.isAdmin !== isAdmin) {
      await client.query(
        `
          UPDATE "loopUser"
          SET "isAdmin" = $3
          WHERE "loop" = $1
            AND "user" = $2
        `,
        [loopId, targetUser, isAdmin],
      );

      await client.query(
        `
          INSERT INTO "loopUserRoleAudit" ("loop", "user", "changedBy", "wasAdmin", "isAdmin")
          VALUES ($1, $2, $3, $4, $5)
        `,
        [loopId, targetUser, changedBy, member.isAdmin, isAdmin],
      );
    }

    await client.query(`COMMIT`);

    return queryLoopMemberByUserId(loopId, targetUser);
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};
