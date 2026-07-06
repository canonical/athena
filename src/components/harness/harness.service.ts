import { getPool } from "@components/postgres/postgres.js";
import { decryptSecret, encryptSecret } from "@components/utilities/secret-envelope.js";
import type { Harness, HarnessInsert, HarnessUpdate, LoopHarness, LoopHarnessAdminUpdate } from "./harness.schema.js";

const harnessColumns = `"id", "owner", "displayName", "runnerType", "lifecycleStatus", "createdAt", "updatedAt"`;

export const queryHarnessListByOwner = async (ownerId: string): Promise<Harness[]> => {
  const result = await getPool().query<Harness>(
    `
      SELECT ${harnessColumns}, TRUE AS "hasCredential"
      FROM "harness"
      WHERE "owner" = $1
      ORDER BY "createdAt" ASC, "id" ASC
    `,
    [ownerId],
  );

  return result.rows;
};

export const queryHarnessByIdForOwner = async (harnessId: string, ownerId: string): Promise<Harness | undefined> => {
  const result = await getPool().query<Harness>(
    `
      SELECT ${harnessColumns}, TRUE AS "hasCredential"
      FROM "harness"
      WHERE "id" = $1
        AND "owner" = $2
    `,
    [harnessId, ownerId],
  );

  return result.rows[0];
};

export const queryHarnessCreate = async (input: HarnessInsert, ownerId: string): Promise<Harness> => {
  const envelope = encryptSecret(input.apiKey);

  const result = await getPool().query<Harness>(
    `
      INSERT INTO "harness" (
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
      RETURNING ${harnessColumns}, TRUE AS "hasCredential"
    `,
    [ownerId, input.displayName, input.runnerType, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, input.lifecycleStatus],
  );

  const harness = result.rows[0];

  if (!harness) {
    throw new Error(`Harness was not created.`);
  }

  return harness;
};

export const queryHarnessUpdate = async (harnessId: string, ownerId: string, input: HarnessUpdate): Promise<Harness | undefined> => {
  if (input.apiKey) {
    const envelope = encryptSecret(input.apiKey);
    const result = await getPool().query<Harness>(
      `
        UPDATE "harness"
        SET
          "displayName" = $1,
          "lifecycleStatus" = $2,
          "credentialCiphertext" = $3,
          "credentialIv" = $4,
          "credentialAuthTag" = $5,
          "credentialKeyVersion" = $6
        WHERE "id" = $7
          AND "owner" = $8
        RETURNING ${harnessColumns}, TRUE AS "hasCredential"
      `,
      [input.displayName, input.lifecycleStatus, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, harnessId, ownerId],
    );

    return result.rows[0];
  }

  const result = await getPool().query<Harness>(
    `
      UPDATE "harness"
      SET
        "displayName" = $1,
        "lifecycleStatus" = $2
      WHERE "id" = $3
        AND "owner" = $4
      RETURNING ${harnessColumns}, TRUE AS "hasCredential"
    `,
    [input.displayName, input.lifecycleStatus, harnessId, ownerId],
  );

  return result.rows[0];
};

export const queryHarnessDelete = async (harnessId: string, ownerId: string): Promise<boolean> => {
  const result = await getPool().query(`DELETE FROM "harness" WHERE "id" = $1 AND "owner" = $2`, [harnessId, ownerId]);

  return Boolean(result.rowCount);
};

export const queryLoopHarnessList = async (loopId: string): Promise<LoopHarness[]> => {
  const result = await getPool().query<LoopHarness>(
    `
      SELECT
        lh."loop",
        lh."harness",
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
      FROM "loopHarness" lh
      JOIN "harness" h ON h."id" = lh."harness"
      WHERE lh."loop" = $1
      ORDER BY COALESCE(lh."priorityOverride", lh."priority") ASC, lh."createdAt" ASC, lh."harness" ASC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryLoopHarnessCreate = async (loopId: string, harnessId: string): Promise<void> => {
  const result = await getPool().query<{ nextPriority: number }>(
    `
      SELECT COALESCE(MAX("priority"), 0) + 1 AS "nextPriority"
      FROM "loopHarness"
      WHERE "loop" = $1
    `,
    [loopId],
  );

  const nextPriority = result.rows[0]?.nextPriority ?? 1;

  await getPool().query(
    `
      INSERT INTO "loopHarness" ("loop", "harness", "priority")
      VALUES ($1, $2, $3)
      ON CONFLICT ("loop", "harness") DO NOTHING
    `,
    [loopId, harnessId, nextPriority],
  );
};

export const queryLoopHarnessUpdateByAdmin = async (loopId: string, harnessId: string, input: LoopHarnessAdminUpdate): Promise<LoopHarness | undefined> => {
  const result = await getPool().query(
    `
      UPDATE "loopHarness"
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
        AND "harness" = $13
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
      harnessId,
    ],
  );

  if (!result.rowCount) {
    return undefined;
  }

  const assignments = await queryLoopHarnessList(loopId);
  return assignments.find((assignment) => assignment.harness === harnessId);
};

export const queryLoopHarnessDelete = async (loopId: string, harnessId: string): Promise<boolean> => {
  const result = await getPool().query(`DELETE FROM "loopHarness" WHERE "loop" = $1 AND "harness" = $2`, [loopId, harnessId]);

  return Boolean(result.rowCount);
};

export type LoopCopilotCandidateRow = {
  loop: string;
  harness: string;
  priority: number;
  priorityOverride: number | null;
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  selectionWeight: number;
  remainingCreditPercentage: number | null;
  remainingCreditValue: number | null;
  lastUsedAt: Date | string | null;
  lastFailedAt: Date | string | null;
  cooldownUntil: Date | string | null;
  healthStatus: `unknown` | `healthy` | `failing`;
  createdAt: Date | string;
  definitionCreatedAt: Date | string;
  credentialCiphertext: string;
  credentialIv: string;
  credentialAuthTag: string;
  credentialKeyVersion: string;
  runnerType: string;
  displayName: string;
};

export const queryLoopCopilotCandidates = async (loopId: string): Promise<LoopCopilotCandidateRow[]> => {
  const result = await getPool().query<LoopCopilotCandidateRow>(
    `
      SELECT
        lh."loop",
        lh."harness",
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
      FROM "loopHarness" lh
      JOIN "harness" h ON h."id" = lh."harness"
      WHERE lh."loop" = $1
        AND h."lifecycleStatus" = 'active'
    `,
    [loopId],
  );

  return result.rows;
};

export const queryHarnessCredential = async (harnessId: string, requesterId: string, loopId?: string): Promise<string | undefined> => {
  const result = await getPool().query<{ credentialCiphertext: string; credentialIv: string; credentialAuthTag: string; credentialKeyVersion: string }>(
    `
      SELECT h."credentialCiphertext", h."credentialIv", h."credentialAuthTag", h."credentialKeyVersion"
      FROM "harness" h
      WHERE h."id" = $1
        AND (
          h."owner" = $2
          OR (
            $3::uuid IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM "loopHarness" lh
              JOIN "loopUser" lu ON lu."loop" = lh."loop"
              WHERE lh."harness" = h."id"
                AND lh."loop" = $3::uuid
                AND lu."user" = $2
            )
          )
        )
    `,
    [harnessId, requesterId, loopId ?? null],
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
