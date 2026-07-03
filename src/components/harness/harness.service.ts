import { getPool } from "@components/postgres/postgres.js";
import { decryptSecret, encryptSecret } from "@components/utilities/secret-envelope.js";
import type { LoopHarnessAssignment } from "./harness.schema.js";
import type { HarnessDefinition, HarnessDefinitionInsert, HarnessDefinitionUpdate, LoopHarnessAssignmentAdminUpdate } from "./harness.schema.js";

const harnessColumns = `"id", "owner", "displayName", "harnessType", "lifecycleStatus", "createdAt", "updatedAt"`;

export const queryHarnessDefinitionListByOwner = async (ownerId: string): Promise<HarnessDefinition[]> => {
  const result = await getPool().query<HarnessDefinition>(
    `
      SELECT ${harnessColumns}, TRUE AS "hasCredential"
      FROM "harnessDefinition"
      WHERE "owner" = $1
      ORDER BY "createdAt" ASC, "id" ASC
    `,
    [ownerId],
  );

  return result.rows;
};

export const queryHarnessDefinitionByIdForOwner = async (harnessDefinitionId: string, ownerId: string): Promise<HarnessDefinition | undefined> => {
  const result = await getPool().query<HarnessDefinition>(
    `
      SELECT ${harnessColumns}, TRUE AS "hasCredential"
      FROM "harnessDefinition"
      WHERE "id" = $1
        AND "owner" = $2
    `,
    [harnessDefinitionId, ownerId],
  );

  return result.rows[0];
};

export const queryHarnessDefinitionCreate = async (input: HarnessDefinitionInsert, ownerId: string): Promise<HarnessDefinition> => {
  const envelope = encryptSecret(input.apiKey);

  const result = await getPool().query<HarnessDefinition>(
    `
      INSERT INTO "harnessDefinition" (
        "owner",
        "displayName",
        "harnessType",
        "credentialCiphertext",
        "credentialIv",
        "credentialAuthTag",
        "credentialKeyVersion",
        "lifecycleStatus"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING ${harnessColumns}, TRUE AS "hasCredential"
    `,
    [ownerId, input.displayName, input.harnessType, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, input.lifecycleStatus],
  );

  const harnessDefinition = result.rows[0];

  if (!harnessDefinition) {
    throw new Error(`Harness definition was not created.`);
  }

  return harnessDefinition;
};

export const queryHarnessDefinitionUpdate = async (harnessDefinitionId: string, ownerId: string, input: HarnessDefinitionUpdate): Promise<HarnessDefinition | undefined> => {
  if (input.apiKey) {
    const envelope = encryptSecret(input.apiKey);
    const result = await getPool().query<HarnessDefinition>(
      `
        UPDATE "harnessDefinition"
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
      [input.displayName, input.lifecycleStatus, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, harnessDefinitionId, ownerId],
    );

    return result.rows[0];
  }

  const result = await getPool().query<HarnessDefinition>(
    `
      UPDATE "harnessDefinition"
      SET
        "displayName" = $1,
        "lifecycleStatus" = $2
      WHERE "id" = $3
        AND "owner" = $4
      RETURNING ${harnessColumns}, TRUE AS "hasCredential"
    `,
    [input.displayName, input.lifecycleStatus, harnessDefinitionId, ownerId],
  );

  return result.rows[0];
};

export const queryHarnessDefinitionDelete = async (harnessDefinitionId: string, ownerId: string): Promise<boolean> => {
  const result = await getPool().query(`DELETE FROM "harnessDefinition" WHERE "id" = $1 AND "owner" = $2`, [harnessDefinitionId, ownerId]);

  return Boolean(result.rowCount);
};

export const queryLoopHarnessAssignmentList = async (loopId: string): Promise<LoopHarnessAssignment[]> => {
  const result = await getPool().query<LoopHarnessAssignment>(
    `
      SELECT
        lhd."loop",
        lhd."harnessDefinition",
        lhd."priority",
        lhd."priorityOverride",
        lhd."enabled",
        lhd."timeoutMs",
        lhd."maxRetries",
        lhd."selectionWeight",
        lhd."assignmentOverrides",
        lhd."remainingCreditPercentage",
        lhd."remainingCreditValue",
        lhd."cooldownUntil",
        lhd."healthStatus",
        lhd."lastUsedAt",
        lhd."lastFailedAt",
        lhd."failureCount",
        lhd."createdAt",
        lhd."updatedAt",
        hd."displayName",
        hd."harnessType"
      FROM "loopHarnessDefinition" lhd
      JOIN "harnessDefinition" hd ON hd."id" = lhd."harnessDefinition"
      WHERE lhd."loop" = $1
      ORDER BY COALESCE(lhd."priorityOverride", lhd."priority") ASC, lhd."createdAt" ASC, lhd."harnessDefinition" ASC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryLoopHarnessAssignmentCreate = async (loopId: string, harnessDefinitionId: string): Promise<void> => {
  const result = await getPool().query<{ nextPriority: number }>(
    `
      SELECT COALESCE(MAX("priority"), 0) + 1 AS "nextPriority"
      FROM "loopHarnessDefinition"
      WHERE "loop" = $1
    `,
    [loopId],
  );

  const nextPriority = result.rows[0]?.nextPriority ?? 1;

  await getPool().query(
    `
      INSERT INTO "loopHarnessDefinition" ("loop", "harnessDefinition", "priority")
      VALUES ($1, $2, $3)
      ON CONFLICT ("loop", "harnessDefinition") DO NOTHING
    `,
    [loopId, harnessDefinitionId, nextPriority],
  );
};

export const queryLoopHarnessAssignmentUpdateByAdmin = async (loopId: string, harnessDefinitionId: string, input: LoopHarnessAssignmentAdminUpdate): Promise<LoopHarnessAssignment | undefined> => {
  const result = await getPool().query<LoopHarnessAssignment>(
    `
      UPDATE "loopHarnessDefinition"
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
        AND "harnessDefinition" = $13
      RETURNING
        "loop",
        "harnessDefinition",
        "priority",
        "priorityOverride",
        "enabled",
        "timeoutMs",
        "maxRetries",
        "selectionWeight",
        "assignmentOverrides",
        "remainingCreditPercentage",
        "remainingCreditValue",
        "cooldownUntil",
        "healthStatus",
        "lastUsedAt",
        "lastFailedAt",
        "failureCount",
        "createdAt",
        "updatedAt",
        '' AS "displayName",
        '' AS "harnessType"
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
      harnessDefinitionId,
    ],
  );

  return result.rows[0];
};

export const queryLoopHarnessAssignmentDelete = async (loopId: string, harnessDefinitionId: string): Promise<boolean> => {
  const result = await getPool().query(`DELETE FROM "loopHarnessDefinition" WHERE "loop" = $1 AND "harnessDefinition" = $2`, [loopId, harnessDefinitionId]);

  return Boolean(result.rowCount);
};

export type LoopCopilotCandidateRow = {
  loop: string;
  harnessDefinition: string;
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
  harnessType: string;
  displayName: string;
};

export const queryLoopCopilotCandidates = async (loopId: string): Promise<LoopCopilotCandidateRow[]> => {
  const result = await getPool().query<LoopCopilotCandidateRow>(
    `
      SELECT
        lhd."loop",
        lhd."harnessDefinition",
        lhd."priority",
        lhd."priorityOverride",
        lhd."enabled",
        lhd."timeoutMs",
        lhd."maxRetries",
        lhd."selectionWeight",
        lhd."remainingCreditPercentage",
        lhd."remainingCreditValue",
        lhd."lastUsedAt",
        lhd."lastFailedAt",
        lhd."cooldownUntil",
        lhd."healthStatus",
        lhd."createdAt",
        hd."createdAt" AS "definitionCreatedAt",
        hd."credentialCiphertext",
        hd."credentialIv",
        hd."credentialAuthTag",
        hd."credentialKeyVersion",
        hd."harnessType",
        hd."displayName"
      FROM "loopHarnessDefinition" lhd
      JOIN "harnessDefinition" hd ON hd."id" = lhd."harnessDefinition"
      WHERE lhd."loop" = $1
        AND hd."lifecycleStatus" = 'active'
    `,
    [loopId],
  );

  return result.rows;
};

export const queryHarnessCredential = async (harnessDefinitionId: string): Promise<string | undefined> => {
  const result = await getPool().query<{ credentialCiphertext: string; credentialIv: string; credentialAuthTag: string; credentialKeyVersion: string }>(
    `
      SELECT "credentialCiphertext", "credentialIv", "credentialAuthTag", "credentialKeyVersion"
      FROM "harnessDefinition"
      WHERE "id" = $1
    `,
    [harnessDefinitionId],
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
