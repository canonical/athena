import { getPool } from "@components/postgres/postgres.js";
import { decryptSecret, encryptSecret } from "@components/utilities/secret-envelope.js";
import type { LoopRunner, LoopRunnerAdminUpdate, Runner, RunnerInsert, RunnerUpdate } from "./runner.schema.js";

const runnerColumns = `"id", "owner", "displayName", "runnerType", "lifecycleStatus", "createdAt", "updatedAt"`;

export const queryRunnerListByOwner = async (ownerId: string): Promise<Runner[]> => {
  const result = await getPool().query<Runner>(
    `
      SELECT ${runnerColumns}, TRUE AS "hasCredential"
      FROM "runner"
      WHERE "owner" = $1
      ORDER BY "createdAt" ASC, "id" ASC
    `,
    [ownerId],
  );

  return result.rows;
};

export const queryRunnerByIdForOwner = async (runnerId: string, ownerId: string): Promise<Runner | undefined> => {
  const result = await getPool().query<Runner>(
    `
      SELECT ${runnerColumns}, TRUE AS "hasCredential"
      FROM "runner"
      WHERE "id" = $1
        AND "owner" = $2
    `,
    [runnerId, ownerId],
  );

  return result.rows[0];
};

export const queryRunnerCreate = async (input: RunnerInsert, ownerId: string): Promise<Runner> => {
  const envelope = encryptSecret(input.apiKey);

  const result = await getPool().query<Runner>(
    `
      INSERT INTO "runner" (
        "owner",
        "displayName",
        "runnerType",
        "credentialCiphertext",
        "credentialIv",
        "credentialAuthTag",
        "credentialKeyVersion",
        "lifecycleStatus"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING ${runnerColumns}, TRUE AS "hasCredential"
    `,
    [ownerId, input.displayName, input.runnerType, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, input.lifecycleStatus],
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
    const result = await getPool().query<Runner>(
      `
        UPDATE "runner"
        SET
          "displayName" = $1,
          "lifecycleStatus" = $2,
          "credentialCiphertext" = $3,
          "credentialIv" = $4,
          "credentialAuthTag" = $5,
          "credentialKeyVersion" = $6
        WHERE "id" = $7
          AND "owner" = $8
        RETURNING ${runnerColumns}, TRUE AS "hasCredential"
      `,
      [input.displayName, input.lifecycleStatus, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, runnerId, ownerId],
    );

    return result.rows[0];
  }

  const result = await getPool().query<Runner>(
    `
      UPDATE "runner"
      SET
        "displayName" = $1,
        "lifecycleStatus" = $2
      WHERE "id" = $3
        AND "owner" = $4
      RETURNING ${runnerColumns}, TRUE AS "hasCredential"
    `,
    [input.displayName, input.lifecycleStatus, runnerId, ownerId],
  );

  return result.rows[0];
};

export const queryRunnerDelete = async (runnerId: string, ownerId: string): Promise<boolean> => {
  const result = await getPool().query(`DELETE FROM "runner" WHERE "id" = $1 AND "owner" = $2`, [runnerId, ownerId]);

  return Boolean(result.rowCount);
};

export const queryLoopRunnerList = async (loopId: string): Promise<LoopRunner[]> => {
  const result = await getPool().query<LoopRunner>(
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
        h."displayName",
        h."runnerType"
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
  const result = await getPool().query<{ nextPriority: number }>(
    `
      SELECT COALESCE(MAX("priority"), 0) + 1 AS "nextPriority"
      FROM "loopRunner"
      WHERE "loop" = $1
    `,
    [loopId],
  );

  const nextPriority = result.rows[0]?.nextPriority ?? 1;

  await getPool().query(
    `
      INSERT INTO "loopRunner" ("loop", "runner", "priority")
      VALUES ($1, $2, $3)
      ON CONFLICT ("loop", "runner") DO NOTHING
    `,
    [loopId, runnerId, nextPriority],
  );
};

export const queryLoopRunnerUpdateByAdmin = async (loopId: string, runnerId: string, input: LoopRunnerAdminUpdate): Promise<LoopRunner | undefined> => {
  const result = await getPool().query(
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
  const result = await getPool().query(`DELETE FROM "loopRunner" WHERE "loop" = $1 AND "runner" = $2`, [loopId, runnerId]);

  return Boolean(result.rowCount);
};

export const queryRunnerDecryptCredential = async (runnerId: string): Promise<string | null> => {
  const result = await getPool().query<{ ciphertext: string; iv: string; authTag: string; keyVersion: string }>(
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

  return decryptSecret({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag, keyVersion: row.keyVersion });
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
  runnerType: string;
  displayName: string;
};

export const queryLoopRunnerCandidates = async (loopId: string): Promise<LoopRunnerCandidateRow[]> => {
  const result = await getPool().query<LoopRunnerCandidateRow>(
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
        h."runnerType",
        h."displayName"
      FROM "loopRunner" lh
      JOIN "runner" h ON h."id" = lh."runner"
      WHERE lh."loop" = $1
        AND h."lifecycleStatus" = 'active'
    `,
    [loopId],
  );

  return result.rows;
};

export const queryRunnerCredential = async (runnerId: string, requesterId: string, loopId?: string): Promise<string | undefined> => {
  const result = await getPool().query<{ credentialCiphertext: string; credentialIv: string; credentialAuthTag: string; credentialKeyVersion: string }>(
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
