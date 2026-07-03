import { getPool } from "@components/postgres/postgres.js";
import { decryptSecret, encryptSecret } from "@components/utilities/secret-envelope.js";
import type { LoopProviderAssignment, LoopProviderAssignmentAdminUpdate, ProviderDefinition, ProviderDefinitionInsert, ProviderDefinitionUpdate } from "./provider.schema.js";

const providerColumns = `"id", "owner", "displayName", "providerType", "baseUrl", "model", "lifecycleStatus", "createdAt", "updatedAt"`;

export const queryProviderDefinitionListByOwner = async (ownerId: string): Promise<ProviderDefinition[]> => {
  const result = await getPool().query<ProviderDefinition>(
    `
      SELECT ${providerColumns}, TRUE AS "hasCredential"
      FROM "providerDefinition"
      WHERE "owner" = $1
      ORDER BY "createdAt" ASC, "id" ASC
    `,
    [ownerId],
  );

  return result.rows;
};

export const queryProviderDefinitionByIdForOwner = async (providerDefinitionId: string, ownerId: string): Promise<ProviderDefinition | undefined> => {
  const result = await getPool().query<ProviderDefinition>(
    `
      SELECT ${providerColumns}, TRUE AS "hasCredential"
      FROM "providerDefinition"
      WHERE "id" = $1
        AND "owner" = $2
    `,
    [providerDefinitionId, ownerId],
  );

  return result.rows[0];
};

export const queryProviderDefinitionCreate = async (input: ProviderDefinitionInsert, ownerId: string): Promise<ProviderDefinition> => {
  const envelope = encryptSecret(input.apiKey);

  const result = await getPool().query<ProviderDefinition>(
    `
      INSERT INTO "providerDefinition" (
        "owner",
        "displayName",
        "providerType",
        "baseUrl",
        "model",
        "credentialCiphertext",
        "credentialIv",
        "credentialAuthTag",
        "credentialKeyVersion",
        "lifecycleStatus"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING ${providerColumns}, TRUE AS "hasCredential"
    `,
    [ownerId, input.displayName, input.providerType, input.baseUrl, input.model ?? null, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, input.lifecycleStatus],
  );

  const providerDefinition = result.rows[0];

  if (!providerDefinition) {
    throw new Error(`Provider definition was not created.`);
  }

  return providerDefinition;
};

export const queryProviderDefinitionUpdate = async (providerDefinitionId: string, ownerId: string, input: ProviderDefinitionUpdate): Promise<ProviderDefinition | undefined> => {
  if (input.apiKey) {
    const envelope = encryptSecret(input.apiKey);
    const result = await getPool().query<ProviderDefinition>(
      `
        UPDATE "providerDefinition"
        SET
          "displayName" = $1,
          "providerType" = $2,
          "baseUrl" = $3,
          "model" = $4,
          "lifecycleStatus" = $5,
          "credentialCiphertext" = $6,
          "credentialIv" = $7,
          "credentialAuthTag" = $8,
          "credentialKeyVersion" = $9
        WHERE "id" = $10
          AND "owner" = $11
        RETURNING ${providerColumns}, TRUE AS "hasCredential"
      `,
      [input.displayName, input.providerType, input.baseUrl, input.model ?? null, input.lifecycleStatus, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, providerDefinitionId, ownerId],
    );

    return result.rows[0];
  }

  const result = await getPool().query<ProviderDefinition>(
    `
      UPDATE "providerDefinition"
      SET
        "displayName" = $1,
        "providerType" = $2,
        "baseUrl" = $3,
        "model" = $4,
        "lifecycleStatus" = $5
      WHERE "id" = $6
        AND "owner" = $7
      RETURNING ${providerColumns}, TRUE AS "hasCredential"
    `,
    [input.displayName, input.providerType, input.baseUrl, input.model ?? null, input.lifecycleStatus, providerDefinitionId, ownerId],
  );

  return result.rows[0];
};

export const queryProviderDefinitionDelete = async (providerDefinitionId: string, ownerId: string): Promise<boolean> => {
  const result = await getPool().query(`DELETE FROM "providerDefinition" WHERE "id" = $1 AND "owner" = $2`, [providerDefinitionId, ownerId]);

  return Boolean(result.rowCount);
};

export const queryLoopProviderAssignmentList = async (loopId: string): Promise<LoopProviderAssignment[]> => {
  const result = await getPool().query<LoopProviderAssignment>(
    `
      SELECT
        lpd."loop",
        lpd."providerDefinition",
        lpd."priority",
        lpd."priorityOverride",
        lpd."enabled",
        lpd."timeoutMs",
        lpd."maxRetries",
        lpd."selectionWeight",
        lpd."assignmentOverrides",
        lpd."remainingCreditPercentage",
        lpd."remainingCreditValue",
        lpd."cooldownUntil",
        lpd."healthStatus",
        lpd."lastUsedAt",
        lpd."lastFailedAt",
        lpd."failureCount",
        lpd."createdAt",
        lpd."updatedAt",
        pd."displayName",
        pd."providerType",
        pd."baseUrl",
        pd."model"
      FROM "loopProviderDefinition" lpd
      JOIN "providerDefinition" pd ON pd."id" = lpd."providerDefinition"
      WHERE lpd."loop" = $1
      ORDER BY COALESCE(lpd."priorityOverride", lpd."priority") ASC, lpd."createdAt" ASC, lpd."providerDefinition" ASC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryLoopProviderAssignmentCreate = async (loopId: string, providerDefinitionId: string): Promise<void> => {
  const result = await getPool().query<{ nextPriority: number }>(
    `
      SELECT COALESCE(MAX("priority"), 0) + 1 AS "nextPriority"
      FROM "loopProviderDefinition"
      WHERE "loop" = $1
    `,
    [loopId],
  );

  const nextPriority = result.rows[0]?.nextPriority ?? 1;

  await getPool().query(
    `
      INSERT INTO "loopProviderDefinition" ("loop", "providerDefinition", "priority")
      VALUES ($1, $2, $3)
      ON CONFLICT ("loop", "providerDefinition") DO NOTHING
    `,
    [loopId, providerDefinitionId, nextPriority],
  );
};

export const queryLoopProviderAssignmentUpdateByAdmin = async (loopId: string, providerDefinitionId: string, input: LoopProviderAssignmentAdminUpdate): Promise<LoopProviderAssignment | undefined> => {
  const result = await getPool().query(
    `
      UPDATE "loopProviderDefinition"
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
        AND "providerDefinition" = $13
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
      providerDefinitionId,
    ],
  );

  if (!result.rowCount) {
    return undefined;
  }

  const assignments = await queryLoopProviderAssignmentList(loopId);
  return assignments.find((assignment) => assignment.providerDefinition === providerDefinitionId);
};

export const queryLoopProviderAssignmentDelete = async (loopId: string, providerDefinitionId: string): Promise<boolean> => {
  const result = await getPool().query(`DELETE FROM "loopProviderDefinition" WHERE "loop" = $1 AND "providerDefinition" = $2`, [loopId, providerDefinitionId]);

  return Boolean(result.rowCount);
};

export type LoopOpenRouterCandidateRow = {
  loop: string;
  providerDefinition: string;
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
  providerType: string;
  displayName: string;
  baseUrl: string;
  model: string | null;
};

export const queryLoopOpenRouterCandidates = async (loopId: string): Promise<LoopOpenRouterCandidateRow[]> => {
  const result = await getPool().query<LoopOpenRouterCandidateRow>(
    `
      SELECT
        lpd."loop",
        lpd."providerDefinition",
        lpd."priority",
        lpd."priorityOverride",
        lpd."enabled",
        lpd."timeoutMs",
        lpd."maxRetries",
        lpd."selectionWeight",
        lpd."remainingCreditPercentage",
        lpd."remainingCreditValue",
        lpd."lastUsedAt",
        lpd."lastFailedAt",
        lpd."cooldownUntil",
        lpd."healthStatus",
        lpd."createdAt",
        pd."createdAt" AS "definitionCreatedAt",
        pd."credentialCiphertext",
        pd."credentialIv",
        pd."credentialAuthTag",
        pd."credentialKeyVersion",
        pd."providerType",
        pd."displayName",
        pd."baseUrl",
        pd."model"
      FROM "loopProviderDefinition" lpd
      JOIN "providerDefinition" pd ON pd."id" = lpd."providerDefinition"
      WHERE lpd."loop" = $1
        AND pd."lifecycleStatus" = 'active'
        AND pd."providerType" = 'openrouter'
    `,
    [loopId],
  );

  return result.rows;
};

export const queryProviderCredential = async (providerDefinitionId: string): Promise<string | undefined> => {
  const result = await getPool().query<{ credentialCiphertext: string; credentialIv: string; credentialAuthTag: string; credentialKeyVersion: string }>(
    `
      SELECT "credentialCiphertext", "credentialIv", "credentialAuthTag", "credentialKeyVersion"
      FROM "providerDefinition"
      WHERE "id" = $1
    `,
    [providerDefinitionId],
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
