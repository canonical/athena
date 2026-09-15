import { createHash, randomBytes } from "node:crypto";
import { query } from "@components/postgres/postgres.js";
import { decryptSecret, encryptSecret } from "@components/utilities/secret-envelope.js";
import { v7 as uuidv7 } from "uuid";
import type {
  LoopRunner,
  LoopRunnerAdminUpdate,
  LoopRunnerRepository,
  Runner,
  RunnerAgentConnect,
  RunnerAgentHeartbeat,
  RunnerInsert,
  RunnerInstance,
  RunnerToken,
  RunnerTokenCreate,
  RunnerTokenCreated,
  RunnerUpdate,
} from "./runner.schema.js";

const runnerColumns = `"id", "owner", "name", "type", "lifecycleStatus", "createdAt", "updatedAt"`;
const runnerCredentialColumn = `("credentialCiphertext" IS NOT NULL) AS "hasCredential"`;

export const queryRunnerListByOwner = async (ownerId: string): Promise<Runner[]> => {
  const result = await query<Runner>(
    `
      SELECT ${runnerColumns}, ${runnerCredentialColumn}
      FROM "runner"
      WHERE "owner" = $1
      ORDER BY "createdAt" ASC, "id" ASC
    `,
    [ownerId],
  );

  return result.rows;
};

export const queryRunnerByIdForOwner = async (runnerId: string, ownerId: string): Promise<Runner | undefined> => {
  const result = await query<Runner>(
    `
      SELECT ${runnerColumns}, ${runnerCredentialColumn}
      FROM "runner"
      WHERE "id" = $1
        AND "owner" = $2
    `,
    [runnerId, ownerId],
  );

  return result.rows[0];
};

export const queryRunnerCreate = async (input: RunnerInsert, ownerId: string): Promise<Runner> => {
  const envelope = input.apiKey ? encryptSecret(input.apiKey) : undefined;

  const result = await query<Runner>(
    `
      INSERT INTO "runner" (
        "owner",
        "name",
        "type",
        "credentialCiphertext",
        "credentialIv",
        "credentialAuthTag",
        "credentialKeyVersion",
        "lifecycleStatus"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING ${runnerColumns}, ${runnerCredentialColumn}
    `,
    [ownerId, input.name, input.type, envelope?.ciphertext ?? null, envelope?.iv ?? null, envelope?.authTag ?? null, envelope?.keyVersion ?? `v1`, input.lifecycleStatus],
  );

  const runner = result.rows[0];

  if (!runner) {
    throw new Error(`Runner was not created.`);
  }

  return runner;
};

export const queryRunnerUpdate = async (runnerId: string, ownerId: string, input: RunnerUpdate): Promise<Runner | undefined> => {
  if (input.apiKey) {
    const envelope = encryptSecret(input.apiKey);
    const result = await query<Runner>(
      `
        UPDATE "runner"
        SET
          "name" = $1,
          "lifecycleStatus" = $2,
          "credentialCiphertext" = $3,
          "credentialIv" = $4,
          "credentialAuthTag" = $5,
          "credentialKeyVersion" = $6
        WHERE "id" = $7
          AND "owner" = $8
        RETURNING ${runnerColumns}, ${runnerCredentialColumn}
      `,
      [input.name, input.lifecycleStatus, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, runnerId, ownerId],
    );

    return result.rows[0];
  }

  const result = await query<Runner>(
    `
      UPDATE "runner"
      SET
        "name" = $1,
        "lifecycleStatus" = $2
      WHERE "id" = $3
        AND "owner" = $4
      RETURNING ${runnerColumns}, ${runnerCredentialColumn}
    `,
    [input.name, input.lifecycleStatus, runnerId, ownerId],
  );

  return result.rows[0];
};

export const queryRunnerDelete = async (runnerId: string, ownerId: string): Promise<boolean> => {
  const result = await query(`DELETE FROM "runner" WHERE "id" = $1 AND "owner" = $2`, [runnerId, ownerId]);

  return Boolean(result.rowCount);
};

export const queryLoopRunnerList = async (loopId: string): Promise<LoopRunner[]> => {
  const result = await query<LoopRunner>(
    `
      SELECT
        lh."loop",
        lh."runner",
        lh."priority",
        lh."priorityOverride",
        lh."enabled",
        lh."timeoutMs",
        lh."maxRetries",
        lh."selectionWeight",
        lh."assignmentOverrides",
        lh."remainingCreditPercentage",
        lh."remainingCreditValue",
        lh."cooldownUntil",
        lh."healthStatus",
        lh."lastUsedAt",
        lh."lastFailedAt",
        lh."failureCount",
        lh."createdAt",
        lh."updatedAt",
        h."name",
        h."type"
      FROM "loopRunner" lh
      JOIN "runner" h ON h."id" = lh."runner"
      WHERE lh."loop" = $1
      ORDER BY COALESCE(lh."priorityOverride", lh."priority") ASC, lh."createdAt" ASC, lh."runner" ASC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryLoopRunnerCreate = async (loopId: string, runnerId: string): Promise<void> => {
  const result = await query<{ nextPriority: number }>(
    `
      SELECT COALESCE(MAX("priority"), 0) + 1 AS "nextPriority"
      FROM "loopRunner"
      WHERE "loop" = $1
    `,
    [loopId],
  );

  const nextPriority = result.rows[0]?.nextPriority ?? 1;

  await query(
    `
      INSERT INTO "loopRunner" ("loop", "runner", "priority")
      VALUES ($1, $2, $3)
      ON CONFLICT ("loop", "runner") DO NOTHING
    `,
    [loopId, runnerId, nextPriority],
  );

  await query(
    `
      INSERT INTO "loopRunnerRepository" ("loop", "runner", "repository")
      SELECT lr."loop", $2::uuid, lr."repository"
      FROM "loopRepository" lr
      WHERE lr."loop" = $1
      ON CONFLICT ("loop", "runner", "repository") DO NOTHING
    `,
    [loopId, runnerId],
  );
};

export const queryLoopRunnerRepositoryReplace = async (loopId: string, runnerId: string, repositoryIds: string[]): Promise<void> => {
  const filtered = [...new Set(repositoryIds)];

  await query(
    `
      DELETE FROM "loopRunnerRepository"
      WHERE "loop" = $1
        AND "runner" = $2
    `,
    [loopId, runnerId],
  );

  if (filtered.length === 0) {
    return;
  }

  await query(
    `
      INSERT INTO "loopRunnerRepository" ("loop", "runner", "repository")
      SELECT $1::uuid, $2::uuid, repo_id
      FROM UNNEST($3::uuid[]) AS repo_id
      WHERE EXISTS (
        SELECT 1
        FROM "loopRepository" lr
        WHERE lr."loop" = $1
          AND lr."repository" = repo_id
      )
      ON CONFLICT ("loop", "runner", "repository") DO NOTHING
    `,
    [loopId, runnerId, filtered],
  );
};

export const queryLoopRunnerRepositoryList = async (loopId: string, runnerId: string): Promise<LoopRunnerRepository[]> => {
  const result = await query<LoopRunnerRepository>(
    `
      SELECT
        lr."loop",
        $2::uuid AS "runner",
        lr."repository",
        (lrr."repository" IS NOT NULL) AS "assigned",
        COALESCE(lrr."enabled", FALSE) AS "enabled",
        lr."enabled" AS "repositoryEnabled",
        r."displayName",
        r."repositoryType",
        r."repositoryOwner",
        r."repositoryName",
        r."defaultBranch",
        r."lifecycleStatus"
      FROM "loopRepository" lr
      JOIN "repository" r ON r."id" = lr."repository"
      LEFT JOIN "loopRunnerRepository" lrr
        ON lrr."loop" = lr."loop"
       AND lrr."runner" = $2
       AND lrr."repository" = lr."repository"
      WHERE lr."loop" = $1
      ORDER BY lr."createdAt" ASC, r."createdAt" ASC
    `,
    [loopId, runnerId],
  );

  return result.rows;
};

export const queryLoopRunnerUpdateByAdmin = async (loopId: string, runnerId: string, input: LoopRunnerAdminUpdate): Promise<LoopRunner | undefined> => {
  const result = await query(
    `
      UPDATE "loopRunner"
      SET
        "priority" = COALESCE($1, "priority"),
        "priorityOverride" = COALESCE($2, "priorityOverride"),
        "enabled" = COALESCE($3, "enabled"),
        "timeoutMs" = COALESCE($4, "timeoutMs"),
        "maxRetries" = COALESCE($5, "maxRetries"),
        "selectionWeight" = COALESCE($6, "selectionWeight"),
        "assignmentOverrides" = COALESCE($7::jsonb, "assignmentOverrides"),
        "remainingCreditPercentage" = COALESCE($8, "remainingCreditPercentage"),
        "remainingCreditValue" = COALESCE($9, "remainingCreditValue"),
        "cooldownUntil" = COALESCE($10, "cooldownUntil"),
        "healthStatus" = COALESCE($11, "healthStatus")
      WHERE "loop" = $12
        AND "runner" = $13
      RETURNING 1
    `,
    [
      input.priority ?? null,
      input.priorityOverride ?? null,
      input.enabled ?? null,
      input.timeoutMs ?? null,
      input.maxRetries ?? null,
      input.selectionWeight ?? null,
      input.assignmentOverrides ? JSON.stringify(input.assignmentOverrides) : null,
      input.remainingCreditPercentage ?? null,
      input.remainingCreditValue ?? null,
      input.cooldownUntil ? new Date(input.cooldownUntil) : null,
      input.healthStatus ?? null,
      loopId,
      runnerId,
    ],
  );

  if (!result.rowCount) {
    return undefined;
  }

  const assignments = await queryLoopRunnerList(loopId);
  return assignments.find((assignment) => assignment.runner === runnerId);
};

export const queryLoopRunnerDelete = async (loopId: string, runnerId: string): Promise<boolean> => {
  const result = await query(`DELETE FROM "loopRunner" WHERE "loop" = $1 AND "runner" = $2`, [loopId, runnerId]);

  return Boolean(result.rowCount);
};

export const queryRunnerDecryptCredential = async (runnerId: string): Promise<string | null> => {
  const result = await query<{ ciphertext: string; iv: string; authTag: string; keyVersion: string }>(
    `
      SELECT "credentialCiphertext" AS ciphertext, "credentialIv" AS iv, "credentialAuthTag" AS "authTag", "credentialKeyVersion" AS "keyVersion"
      FROM "runner"
      WHERE "id" = $1
    `,
    [runnerId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  if (!row.ciphertext || !row.iv || !row.authTag) {
    return null;
  }

  return decryptSecret({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag, keyVersion: row.keyVersion });
};

const hashToken = (token: string): string => createHash(`sha256`).update(token).digest(`hex`);

export const queryRunnerTokenList = async (runnerId: string): Promise<RunnerToken[]> => {
  const result = await query<RunnerToken>(`SELECT "id", "runner", "name", "expiresAt", "lastUsedAt", "revokedAt", "createdAt" FROM "runnerToken" WHERE "runner" = $1 ORDER BY "createdAt" ASC`, [runnerId]);
  return result.rows;
};

export const queryRunnerTokenCreate = async (runnerId: string, input: RunnerTokenCreate): Promise<RunnerTokenCreated> => {
  const id = uuidv7();
  const token = `athena_runner_${id}_${randomBytes(32).toString(`hex`)}`;
  const result = await query<RunnerToken>(`INSERT INTO "runnerToken" ("id", "runner", "name", "secretHash") VALUES ($1, $2, $3, $4) RETURNING "id", "runner", "name", "expiresAt", "lastUsedAt", "revokedAt", "createdAt"`, [
    id,
    runnerId,
    input.name,
    hashToken(token),
  ]);
  const metadata = result.rows[0];
  if (!metadata) throw new Error(`Runner token was not created.`);
  return { ...metadata, token };
};

export const queryRunnerTokenRevoke = async (runnerId: string, tokenId: string): Promise<boolean> => {
  const result = await query(`UPDATE "runnerToken" SET "revokedAt" = COALESCE("revokedAt", NOW()), "secretHash" = NULL WHERE "id" = $1 AND "runner" = $2`, [tokenId, runnerId]);
  return Boolean(result.rowCount);
};

export const queryRunnerAgentConnect = async (token: string, input: RunnerAgentConnect): Promise<RunnerInstance | undefined> => {
  const result = await query<{ runner: string; secretHash: string }>(
    `SELECT t."runner", t."secretHash" FROM "runnerToken" t JOIN "runner" r ON r."id" = t."runner" WHERE t."revokedAt" IS NULL AND (t."expiresAt" IS NULL OR t."expiresAt" > NOW()) AND r."type" = 'athena-workshop' AND r."lifecycleStatus" = 'active' AND t."secretHash" = $1`,
    [hashToken(token)],
  );
  const tokenRow = result.rows[0];
  if (!tokenRow) return undefined;
  await query(`UPDATE "runnerToken" SET "lastUsedAt" = NOW() WHERE "secretHash" = $1`, [tokenRow.secretHash]);
  return queryRunnerInstanceUpsert(tokenRow.runner, input);
};

export const queryRunnerInstanceUpsert = async (runnerId: string, input: RunnerAgentConnect | RunnerAgentHeartbeat): Promise<RunnerInstance> => {
  const result = await query<RunnerInstance>(
    `INSERT INTO "runnerInstance" ("id", "runner", "name", "agentVersion", "contractVersion", "capabilities", "capacity") VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb) ON CONFLICT ("id") DO UPDATE SET "runner" = EXCLUDED."runner", "name" = EXCLUDED."name", "agentVersion" = EXCLUDED."agentVersion", "contractVersion" = EXCLUDED."contractVersion", "capabilities" = EXCLUDED."capabilities", "capacity" = EXCLUDED."capacity", "lastSeenAt" = NOW() RETURNING "id", "runner", "name", "agentVersion", "contractVersion", "capabilities", "capacity", "lastSeenAt", "connectedAt", "createdAt", "updatedAt"`,
    [input.instanceId, runnerId, input.name, input.agentVersion, input.contractVersion, JSON.stringify(input.capabilities), JSON.stringify(input.capacity)],
  );
  return result.rows[0] as RunnerInstance;
};

export const queryRunnerInstanceList = async (runnerId: string): Promise<RunnerInstance[]> => {
  const result = await query<RunnerInstance>(
    `SELECT "id", "runner", "name", "agentVersion", "contractVersion", "capabilities", "capacity", "lastSeenAt", "connectedAt", "createdAt", "updatedAt" FROM "runnerInstance" WHERE "runner" = $1 ORDER BY "lastSeenAt" DESC`,
    [runnerId],
  );
  return result.rows;
};

export type LoopRunnerCandidateRow = {
  loop: string;
  runner: string;
  priority: number;
  priorityOverride: number | null;
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  selectionWeight: number;
  remainingCreditPercentage: number | null;
  remainingCreditValue: number | null;
  lastUsedAt: string | null;
  lastFailedAt: string | null;
  cooldownUntil: string | null;
  healthStatus: `unknown` | `healthy` | `failing`;
  createdAt: string;
  definitionCreatedAt: string;
  credentialCiphertext: string;
  credentialIv: string;
  credentialAuthTag: string;
  credentialKeyVersion: string;
  type: string;
  displayName: string;
};

export const queryLoopRunnerCandidates = async (loopId: string, repositoryId?: string): Promise<LoopRunnerCandidateRow[]> => {
  const result = await query<LoopRunnerCandidateRow>(
    `
      SELECT
        lh."loop",
        lh."runner",
        lh."priority",
        lh."priorityOverride",
        lh."enabled",
        lh."timeoutMs",
        lh."maxRetries",
        lh."selectionWeight",
        lh."remainingCreditPercentage",
        lh."remainingCreditValue",
        lh."lastUsedAt",
        lh."lastFailedAt",
        lh."cooldownUntil",
        lh."healthStatus",
        lh."createdAt",
        h."createdAt" AS "definitionCreatedAt",
        h."credentialCiphertext",
        h."credentialIv",
        h."credentialAuthTag",
        h."credentialKeyVersion",
        h."type",
        h."name"
      FROM "loopRunner" lh
      JOIN "runner" h ON h."id" = lh."runner"
      WHERE lh."loop" = $1
        AND h."lifecycleStatus" = 'active'
        AND (
          $2::uuid IS NULL
          OR EXISTS (
            SELECT 1
            FROM "loopRunnerRepository" lrr
            WHERE lrr."loop" = lh."loop"
              AND lrr."runner" = lh."runner"
              AND lrr."repository" = $2::uuid
              AND lrr."enabled" = TRUE
          )
        )
    `,
    [loopId, repositoryId ?? null],
  );

  return result.rows;
};

export const queryLoopRunnersForRepository = async (loopId: string, repositoryId: string): Promise<LoopRunner[]> => {
  const result = await query<LoopRunner>(
    `
      SELECT
        lh."loop",
        lh."runner",
        lh."priority",
        lh."priorityOverride",
        lh."enabled",
        lh."timeoutMs",
        lh."maxRetries",
        lh."selectionWeight",
        lh."assignmentOverrides",
        lh."remainingCreditPercentage",
        lh."remainingCreditValue",
        lh."cooldownUntil",
        lh."healthStatus",
        lh."lastUsedAt",
        lh."lastFailedAt",
        lh."failureCount",
        lh."createdAt",
        lh."updatedAt",
        h."name",
        h."type"
      FROM "loopRunner" lh
      JOIN "runner" h ON h."id" = lh."runner"
      JOIN "loopRunnerRepository" lrr
        ON lrr."loop" = lh."loop"
       AND lrr."runner" = lh."runner"
       AND lrr."repository" = $2
       AND lrr."enabled" = TRUE
      WHERE lh."loop" = $1
        AND h."lifecycleStatus" = 'active'
      ORDER BY COALESCE(lh."priorityOverride", lh."priority") ASC, lh."createdAt" ASC, lh."runner" ASC
    `,
    [loopId, repositoryId],
  );

  return result.rows;
};

export const queryRunnerCredential = async (runnerId: string, requesterId: string, loopId?: string): Promise<string | undefined> => {
  const result = await query<{ credentialCiphertext: string; credentialIv: string; credentialAuthTag: string; credentialKeyVersion: string }>(
    `
      SELECT h."credentialCiphertext", h."credentialIv", h."credentialAuthTag", h."credentialKeyVersion"
      FROM "runner" h
      WHERE h."id" = $1
        AND (
          h."owner" = $2
          OR (
            $3::uuid IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM "loopRunner" lh
              JOIN "loopUser" lu ON lu."loop" = lh."loop"
              WHERE lh."runner" = h."id"
                AND lh."loop" = $3::uuid
                AND lu."user" = $2
            )
          )
        )
    `,
    [runnerId, requesterId, loopId ?? null],
  );

  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  return decryptSecret({
    ciphertext: row.credentialCiphertext,
    iv: row.credentialIv,
    authTag: row.credentialAuthTag,
    keyVersion: row.credentialKeyVersion,
  });
};
