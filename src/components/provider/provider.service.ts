import { query } from "@components/postgres/postgres.js";
import { decryptSecret, encryptSecret } from "@components/utilities/secret-envelope.js";
import type { LoopProvider, LoopProviderAdminUpdate, Provider, ProviderInsert, ProviderUpdate } from "./provider.schema.js";

const providerColumns = `"id", "owner", "displayName", "providerType", "baseUrl", "chatDefaultModel", "chatEnabledModels", "embeddingDefaultModel", "embeddingEnabledModels", "lifecycleStatus", "createdAt", "updatedAt"`;

export const queryProviderListByOwner = async (ownerId: string): Promise<Provider[]> => {
  const result = await query<Provider>(
    `
      SELECT ${providerColumns}, TRUE AS "hasCredential"
      FROM "provider"
      WHERE "owner" = $1
      ORDER BY "createdAt" ASC, "id" ASC
    `,
    [ownerId],
  );

  return result.rows;
};

export const queryProviderByIdForOwner = async (providerId: string, ownerId: string): Promise<Provider | undefined> => {
  const result = await query<Provider>(
    `
      SELECT ${providerColumns}, TRUE AS "hasCredential"
      FROM "provider"
      WHERE "id" = $1
        AND "owner" = $2
    `,
    [providerId, ownerId],
  );

  return result.rows[0];
};

export const queryProviderCreate = async (input: ProviderInsert, ownerId: string): Promise<Provider> => {
  const envelope = encryptSecret(input.apiKey);

  const result = await query<Provider>(
    `
      INSERT INTO "provider" (
        "owner",
        "displayName",
        "providerType",
        "baseUrl",
        "chatDefaultModel",
        "chatEnabledModels",
        "embeddingDefaultModel",
        "embeddingEnabledModels",
        "credentialCiphertext",
        "credentialIv",
        "credentialAuthTag",
        "credentialKeyVersion",
        "lifecycleStatus"
      )
      VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8::text[], $9, $10, $11, $12, $13)
      RETURNING ${providerColumns}, TRUE AS "hasCredential"
    `,
    [
      ownerId,
      input.displayName,
      input.providerType,
      input.baseUrl,
      input.chatDefaultModel,
      input.chatEnabledModels,
      input.embeddingDefaultModel,
      input.embeddingEnabledModels,
      envelope.ciphertext,
      envelope.iv,
      envelope.authTag,
      envelope.keyVersion,
      input.lifecycleStatus,
    ],
  );

  const provider = result.rows[0];

  if (!provider) {
    throw new Error(`Provider was not created.`);
  }

  return provider;
};

export const queryProviderUpdate = async (providerId: string, ownerId: string, input: ProviderUpdate): Promise<Provider | undefined> => {
  if (input.apiKey) {
    const envelope = encryptSecret(input.apiKey);
    const result = await query<Provider>(
      `
        UPDATE "provider"
        SET
          "displayName" = $1,
          "providerType" = $2,
          "baseUrl" = $3,
          "chatDefaultModel" = $4,
          "chatEnabledModels" = $5::text[],
          "embeddingDefaultModel" = $6,
          "embeddingEnabledModels" = $7::text[],
          "lifecycleStatus" = $8,
          "credentialCiphertext" = $9,
          "credentialIv" = $10,
          "credentialAuthTag" = $11,
          "credentialKeyVersion" = $12
        WHERE "id" = $13
          AND "owner" = $14
        RETURNING ${providerColumns}, TRUE AS "hasCredential"
      `,
      [
        input.displayName,
        input.providerType,
        input.baseUrl,
        input.chatDefaultModel,
        input.chatEnabledModels,
        input.embeddingDefaultModel,
        input.embeddingEnabledModels,
        input.lifecycleStatus,
        envelope.ciphertext,
        envelope.iv,
        envelope.authTag,
        envelope.keyVersion,
        providerId,
        ownerId,
      ],
    );

    return result.rows[0];
  }

  const result = await query<Provider>(
    `
      UPDATE "provider"
      SET
        "displayName" = $1,
        "providerType" = $2,
        "baseUrl" = $3,
        "chatDefaultModel" = $4,
        "chatEnabledModels" = $5::text[],
        "embeddingDefaultModel" = $6,
        "embeddingEnabledModels" = $7::text[],
        "lifecycleStatus" = $8
      WHERE "id" = $9
        AND "owner" = $10
      RETURNING ${providerColumns}, TRUE AS "hasCredential"
    `,
    [input.displayName, input.providerType, input.baseUrl, input.chatDefaultModel, input.chatEnabledModels, input.embeddingDefaultModel, input.embeddingEnabledModels, input.lifecycleStatus, providerId, ownerId],
  );

  return result.rows[0];
};

export const queryProviderDelete = async (providerId: string, ownerId: string): Promise<boolean> => {
  const result = await query(`DELETE FROM "provider" WHERE "id" = $1 AND "owner" = $2`, [providerId, ownerId]);

  return Boolean(result.rowCount);
};

export const queryLoopProviderList = async (loopId: string): Promise<LoopProvider[]> => {
  const result = await query<LoopProvider>(
    `
      SELECT
        lp."loop",
        lp."provider",
        p."owner",
        lp."priority",
        lp."priorityOverride",
        lp."enabled",
        lp."timeoutMs",
        lp."maxRetries",
        lp."selectionWeight",
        lp."assignmentOverrides",
        lp."remainingCreditPercentage",
        lp."remainingCreditValue",
        lp."cooldownUntil",
        lp."healthStatus",
        lp."lastUsedAt",
        lp."lastFailedAt",
        lp."failureCount",
        lp."createdAt",
        lp."updatedAt",
        p."displayName",
        p."providerType",
        p."baseUrl"
      FROM "loopProvider" lp
      JOIN "provider" p ON p."id" = lp."provider"
      WHERE lp."loop" = $1
      ORDER BY COALESCE(lp."priorityOverride", lp."priority") ASC, lp."createdAt" ASC, lp."provider" ASC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryLoopProviderAssign = async (loopId: string, providerId: string): Promise<void> => {
  const result = await query<{ nextPriority: number }>(
    `
      SELECT COALESCE(MAX("priority"), 0) + 1 AS "nextPriority"
      FROM "loopProvider"
      WHERE "loop" = $1
    `,
    [loopId],
  );

  const nextPriority = result.rows[0]?.nextPriority ?? 1;

  await query(
    `
      INSERT INTO "loopProvider" ("loop", "provider", "priority")
      VALUES ($1, $2, $3)
      ON CONFLICT ("loop", "provider") DO NOTHING
    `,
    [loopId, providerId, nextPriority],
  );
};

export const queryLoopProviderUpdateByAdmin = async (loopId: string, providerId: string, input: LoopProviderAdminUpdate): Promise<LoopProvider | undefined> => {
  const result = await query(
    `
      UPDATE "loopProvider"
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
        AND "provider" = $13
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
      providerId,
    ],
  );

  if (!result.rowCount) {
    return undefined;
  }

  const assignments = await queryLoopProviderList(loopId);
  return assignments.find((assignment) => assignment.provider === providerId);
};

export const queryLoopProviderDelete = async (loopId: string, providerId: string): Promise<boolean> => {
  const result = await query(`DELETE FROM "loopProvider" WHERE "loop" = $1 AND "provider" = $2`, [loopId, providerId]);

  return Boolean(result.rowCount);
};

export type LoopProviderCandidateRow = {
  loop: string;
  provider: string;
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
  providerType: string;
  chatDefaultModel: string | null;
  chatEnabledModels: string[];
  embeddingDefaultModel: string | null;
  embeddingEnabledModels: string[];
  displayName: string;
  baseUrl: string;
};

export const queryLoopProviderCandidates = async (loopId: string): Promise<LoopProviderCandidateRow[]> => {
  const result = await query<LoopProviderCandidateRow>(
    `
      SELECT
        lp."loop",
        lp."provider",
        lp."priority",
        lp."priorityOverride",
        lp."enabled",
        lp."timeoutMs",
        lp."maxRetries",
        lp."selectionWeight",
        lp."remainingCreditPercentage",
        lp."remainingCreditValue",
        lp."lastUsedAt",
        lp."lastFailedAt",
        lp."cooldownUntil",
        lp."healthStatus",
        lp."createdAt",
        p."createdAt" AS "definitionCreatedAt",
        p."credentialCiphertext",
        p."credentialIv",
        p."credentialAuthTag",
        p."credentialKeyVersion",
        p."providerType",
        p."chatDefaultModel",
        COALESCE(p."chatEnabledModels", ARRAY[]::text[]) AS "chatEnabledModels",
        p."embeddingDefaultModel",
        COALESCE(p."embeddingEnabledModels", ARRAY[]::text[]) AS "embeddingEnabledModels",
        p."displayName",
        p."baseUrl"
      FROM "loopProvider" lp
      JOIN "provider" p ON p."id" = lp."provider"
      WHERE lp."loop" = $1
        AND p."lifecycleStatus" = 'active'
        AND p."providerType" = 'openrouter'
    `,
    [loopId],
  );

  return result.rows;
};

type ProviderApiConnection = {
  providerType: string;
  baseUrl: string;
  apiKey: string;
};

export const queryProviderApiConnectionByOwner = async (providerId: string, ownerId: string): Promise<ProviderApiConnection | undefined> => {
  const result = await query<{
    providerType: string;
    baseUrl: string;
    credentialCiphertext: string;
    credentialIv: string;
    credentialAuthTag: string;
    credentialKeyVersion: string;
  }>(
    `
      SELECT
        p."providerType",
        p."baseUrl",
        p."credentialCiphertext",
        p."credentialIv",
        p."credentialAuthTag",
        p."credentialKeyVersion"
      FROM "provider" p
      WHERE p."id" = $1
        AND p."owner" = $2
    `,
    [providerId, ownerId],
  );

  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  return {
    providerType: row.providerType,
    baseUrl: row.baseUrl,
    apiKey: decryptSecret({
      ciphertext: row.credentialCiphertext,
      iv: row.credentialIv,
      authTag: row.credentialAuthTag,
      keyVersion: row.credentialKeyVersion,
    }),
  };
};

export const queryProviderCredential = async (providerId: string, requesterId: string, loopId?: string): Promise<string | undefined> => {
  const result = await query<{ credentialCiphertext: string; credentialIv: string; credentialAuthTag: string; credentialKeyVersion: string }>(
    `
      SELECT p."credentialCiphertext", p."credentialIv", p."credentialAuthTag", p."credentialKeyVersion"
      FROM "provider" p
      WHERE p."id" = $1
        AND (
          p."owner" = $2
          OR (
            $3::uuid IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM "loopProvider" lp
              JOIN "loopUser" lu ON lu."loop" = lp."loop"
              WHERE lp."provider" = p."id"
                AND lp."loop" = $3::uuid
                AND lu."user" = $2
            )
          )
        )
    `,
    [providerId, requesterId, loopId ?? null],
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
