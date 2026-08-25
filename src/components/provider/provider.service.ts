import { getPool, type QueryExecutor, query, withTransaction } from "@components/postgres/postgres.js";
import { decryptSecret, encryptSecret } from "@components/utilities/secret-envelope.js";
import type { LoopProvider, LoopProviderAdminUpdate, Provider, ProviderChatUpdate, ProviderEmbedderUpdate, ProviderInsert, ProviderUpdate } from "./provider.schema.js";

const providerSelect = `
  p."id",
  p."owner",
  p."displayName",
  p."providerType",
  p."baseUrl",
  p."lifecycleStatus",
  TRUE AS "hasCredential",
  CASE
    WHEN pc."provider" IS NULL THEN NULL
    ELSE jsonb_build_object(
      'provider', pc."provider",
      'defaultModel', pc."defaultModel",
      'enabledModels', pc."enabledModels",
      'createdAt', pc."createdAt",
      'updatedAt', pc."updatedAt"
    )
  END AS "chat",
  CASE
    WHEN pe."provider" IS NULL THEN NULL
    ELSE jsonb_build_object(
      'provider', pe."provider",
      'model', pe."model",
      'createdAt', pe."createdAt",
      'updatedAt', pe."updatedAt"
    )
  END AS "embedder",
  p."createdAt",
  p."updatedAt"
`;

type ProviderDependencyLock = {
  baseUrl: string;
  hasChat: boolean;
  hasEmbedder: boolean;
  embeddingModel: string | null;
  history: Array<{ enabled: boolean; loop: string }>;
  lifecycleStatus: `active` | `deprecated` | `archived`;
};

const lockProviderDependencies = async (executor: QueryExecutor, providerId: string, ownerId: string): Promise<ProviderDependencyLock | undefined> => {
  const providerResult = await executor.query<{ baseUrl: string; hasChat: boolean; hasEmbedder: boolean; lifecycleStatus: `active` | `deprecated` | `archived` }>(
    `SELECT p."baseUrl", p."lifecycleStatus",
            EXISTS (SELECT 1 FROM "providerChat" pc WHERE pc."provider" = p."id") AS "hasChat",
            EXISTS (SELECT 1 FROM "providerEmbedder" pe WHERE pe."provider" = p."id") AS "hasEmbedder"
     FROM "provider" p
     WHERE p."id" = $1 AND p."owner" = $2
     FOR UPDATE OF p`,
    [providerId, ownerId],
  );
  const provider = providerResult.rows[0];
  if (!provider) return undefined;

  const embedderResult = provider.hasEmbedder ? await executor.query<{ model: string }>(`SELECT "model" FROM "providerEmbedder" WHERE "provider" = $1 FOR UPDATE`, [providerId]) : undefined;
  const historyResult = provider.hasEmbedder ? await executor.query<{ enabled: boolean; loop: string }>(`SELECT "loop", "enabled" FROM "loopHistoryRag" WHERE "provider" = $1 ORDER BY "loop" FOR UPDATE`, [providerId]) : undefined;

  return {
    ...provider,
    embeddingModel: embedderResult?.rows[0]?.model ?? null,
    history: historyResult?.rows ?? [],
  };
};

const hasEnabledHistory = (dependency: ProviderDependencyLock): boolean => dependency.history.some(({ enabled }) => enabled);

const deleteDisabledHistory = async (executor: QueryExecutor, providerId: string): Promise<void> => {
  await executor.query(`DELETE FROM "loopHistoryRag" WHERE "provider" = $1 AND "enabled" = FALSE`, [providerId]);
};

export const queryProviderListByOwner = async (ownerId: string): Promise<Provider[]> => {
  const result = await query<Provider>(
    `
      SELECT ${providerSelect}
      FROM "provider" p
      LEFT JOIN "providerChat" pc ON pc."provider" = p."id"
      LEFT JOIN "providerEmbedder" pe ON pe."provider" = p."id"
      WHERE p."owner" = $1
      ORDER BY p."createdAt" ASC, p."id" ASC
    `,
    [ownerId],
  );

  return result.rows;
};

export const queryProviderByIdForOwner = async (providerId: string, ownerId: string): Promise<Provider | undefined> => {
  const result = await query<Provider>(
    `
      SELECT ${providerSelect}
      FROM "provider" p
      LEFT JOIN "providerChat" pc ON pc."provider" = p."id"
      LEFT JOIN "providerEmbedder" pe ON pe."provider" = p."id"
      WHERE p."id" = $1
        AND p."owner" = $2
    `,
    [providerId, ownerId],
  );

  return result.rows[0];
};

export const queryProviderCreate = async (input: ProviderInsert, ownerId: string): Promise<Provider> => {
  const envelope = encryptSecret(input.apiKey);
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO "provider" (
          "owner",
          "displayName",
          "providerType",
          "baseUrl",
          "defaultModel",
          "enabledModels",
          "credentialCiphertext",
          "credentialIv",
          "credentialAuthTag",
          "credentialKeyVersion",
          "lifecycleStatus"
        )
        VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10, $11)
        RETURNING "id"
      `,
      [ownerId, input.displayName, input.providerType, input.baseUrl, input.chat?.defaultModel ?? null, input.chat?.enabledModels ?? null, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, input.lifecycleStatus],
    );
    const providerId = result.rows[0]?.id;

    if (!providerId) {
      throw new Error(`Provider was not created.`);
    }

    if (input.chat) {
      await client.query(
        `
          INSERT INTO "providerChat" ("provider", "defaultModel", "enabledModels")
          VALUES ($1, $2, $3::text[])
        `,
        [providerId, input.chat.defaultModel, input.chat.enabledModels],
      );
    }

    if (input.embedder) {
      await client.query(
        `
          INSERT INTO "providerEmbedder" ("provider", "model")
          VALUES ($1, $2)
        `,
        [providerId, input.embedder.model],
      );
    }

    await client.query(`COMMIT`);
    const provider = await queryProviderByIdForOwner(providerId, ownerId);

    if (!provider) {
      throw new Error(`Provider was not created.`);
    }

    return provider;
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

export type ProviderUpdateResult = Provider | `embedder-in-use` | undefined;

export const queryProviderUpdate = async (providerId: string, ownerId: string, input: ProviderUpdate): Promise<ProviderUpdateResult> => {
  const envelope = input.apiKey ? encryptSecret(input.apiKey) : undefined;
  const outcome = await withTransaction(async (transaction) => {
    const dependency = await lockProviderDependencies(transaction, providerId, ownerId);
    if (!dependency) return `not-found` as const;

    const endpointChanged = dependency.hasEmbedder && dependency.baseUrl !== input.baseUrl;
    const embedderDeactivated = dependency.hasEmbedder && dependency.lifecycleStatus === `active` && input.lifecycleStatus !== `active`;
    const embeddingAvailabilityChanged = endpointChanged || embedderDeactivated;
    if (embeddingAvailabilityChanged && hasEnabledHistory(dependency)) return `embedder-in-use` as const;
    if (embeddingAvailabilityChanged) await deleteDisabledHistory(transaction, providerId);

    if (envelope) {
      await transaction.query(
        `
        UPDATE "provider"
        SET
          "displayName" = $1,
          "providerType" = $2,
          "baseUrl" = $3,
          "lifecycleStatus" = $4,
          "credentialCiphertext" = $5,
          "credentialIv" = $6,
          "credentialAuthTag" = $7,
          "credentialKeyVersion" = $8
        WHERE "id" = $9
          AND "owner" = $10
      `,
        [input.displayName, input.providerType, input.baseUrl, input.lifecycleStatus, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, providerId, ownerId],
      );
    } else {
      await transaction.query(
        `UPDATE "provider"
         SET "displayName" = $1, "providerType" = $2, "baseUrl" = $3, "lifecycleStatus" = $4
         WHERE "id" = $5 AND "owner" = $6`,
        [input.displayName, input.providerType, input.baseUrl, input.lifecycleStatus, providerId, ownerId],
      );
    }

    return `updated` as const;
  });

  if (outcome === `not-found`) return undefined;
  if (outcome === `embedder-in-use`) return outcome;
  return queryProviderByIdForOwner(providerId, ownerId);
};

export const queryProviderChatUpsert = async (providerId: string, ownerId: string, input: ProviderChatUpdate): Promise<Provider | undefined> => {
  const result = await query(
    `
      WITH provider_update AS (
        UPDATE "provider"
        SET
          "defaultModel" = $1,
          "enabledModels" = $2::text[]
        WHERE "id" = $3
          AND "owner" = $4
        RETURNING "id"
      )
      INSERT INTO "providerChat" ("provider", "defaultModel", "enabledModels")
      SELECT "id", $1, $2::text[]
      FROM provider_update
      ON CONFLICT ("provider") DO UPDATE
      SET
        "defaultModel" = EXCLUDED."defaultModel",
        "enabledModels" = EXCLUDED."enabledModels"
      RETURNING "provider"
    `,
    [input.defaultModel, input.enabledModels, providerId, ownerId],
  );

  if (!result.rowCount) {
    return undefined;
  }

  return queryProviderByIdForOwner(providerId, ownerId);
};

export type ProviderEmbedderUpdateResult = Provider | `embedder-in-use` | undefined;

export const queryProviderEmbedderUpsert = async (providerId: string, ownerId: string, input: ProviderEmbedderUpdate): Promise<ProviderEmbedderUpdateResult> => {
  const outcome = await withTransaction(async (transaction) => {
    const dependency = await lockProviderDependencies(transaction, providerId, ownerId);
    if (!dependency) return `not-found` as const;

    const modelChanged = dependency.hasEmbedder && dependency.embeddingModel !== input.model;
    if (modelChanged && hasEnabledHistory(dependency)) return `embedder-in-use` as const;
    if (modelChanged) await deleteDisabledHistory(transaction, providerId);

    await transaction.query(
      `INSERT INTO "providerEmbedder" ("provider", "model") VALUES ($1, $2)
       ON CONFLICT ("provider") DO UPDATE SET "model" = EXCLUDED."model"`,
      [providerId, input.model],
    );
    return `updated` as const;
  });

  if (outcome === `not-found`) return undefined;
  if (outcome === `embedder-in-use`) return outcome;
  return queryProviderByIdForOwner(providerId, ownerId);
};

export type ProviderCapabilityDeleteResult = `deleted` | `provider-not-found` | `capability-not-found` | `last-capability` | `chat-assigned` | `embedder-in-use`;

export const queryProviderCapabilityDelete = async (providerId: string, ownerId: string, capability: `chat` | `embedder`): Promise<ProviderCapabilityDeleteResult> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);
    const provider = await lockProviderDependencies(client, providerId, ownerId);

    if (!provider) {
      await client.query(`ROLLBACK`);
      return `provider-not-found`;
    }

    const hasCapability = capability === `chat` ? provider.hasChat : provider.hasEmbedder;
    const hasOtherCapability = capability === `chat` ? provider.hasEmbedder : provider.hasChat;

    if (!hasCapability) {
      await client.query(`ROLLBACK`);
      return `capability-not-found`;
    }

    if (capability === `embedder` && hasEnabledHistory(provider)) {
      await client.query(`ROLLBACK`);
      return `embedder-in-use`;
    }

    if (!hasOtherCapability) {
      await client.query(`ROLLBACK`);
      return `last-capability`;
    }

    if (capability === `chat`) {
      const assignments = await client.query(
        `
          SELECT 1
          FROM "loopProvider"
          WHERE "provider" = $1
          LIMIT 1
        `,
        [providerId],
      );

      if (assignments.rowCount) {
        await client.query(`ROLLBACK`);
        return `chat-assigned`;
      }

      await client.query(
        `
          UPDATE "provider"
          SET
            "defaultModel" = NULL,
            "enabledModels" = NULL
          WHERE "id" = $1
        `,
        [providerId],
      );
      await client.query(`DELETE FROM "providerChat" WHERE "provider" = $1`, [providerId]);
    } else {
      await deleteDisabledHistory(client, providerId);
      await client.query(`DELETE FROM "providerEmbedder" WHERE "provider" = $1`, [providerId]);
    }

    await client.query(`COMMIT`);
    return `deleted`;
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

export type ProviderDeleteResult = `deleted` | `provider-not-found` | `embedder-in-use`;

export const queryProviderDelete = async (providerId: string, ownerId: string): Promise<ProviderDeleteResult> => {
  return withTransaction(async (transaction) => {
    const dependency = await lockProviderDependencies(transaction, providerId, ownerId);
    if (!dependency) return `provider-not-found`;
    if (dependency.hasEmbedder && hasEnabledHistory(dependency)) return `embedder-in-use`;
    if (dependency.hasEmbedder) await deleteDisabledHistory(transaction, providerId);
    await transaction.query(`DELETE FROM "provider" WHERE "id" = $1 AND "owner" = $2`, [providerId, ownerId]);
    return `deleted`;
  });
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
      JOIN "providerChat" pc ON pc."provider" = p."id"
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
  defaultModel: string | null;
  enabledModels: string[];
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
        pc."defaultModel",
        COALESCE(pc."enabledModels", ARRAY[]::text[]) AS "enabledModels",
        p."displayName",
        p."baseUrl"
      FROM "loopProvider" lp
      JOIN "provider" p ON p."id" = lp."provider"
      JOIN "providerChat" pc ON pc."provider" = p."id"
      WHERE lp."loop" = $1
        AND p."lifecycleStatus" = 'active'
        AND p."providerType" = 'openrouter'
    `,
    [loopId],
  );

  return result.rows;
};

export type ProviderApiConnection = {
  providerType: string;
  baseUrl: string;
  apiKey: string;
};

type ProviderConnectionRow = {
  providerType: string;
  baseUrl: string;
  credentialCiphertext: string;
  credentialIv: string;
  credentialAuthTag: string;
  credentialKeyVersion: string;
};

const connectionFromRow = (row: ProviderConnectionRow): ProviderApiConnection => ({
  providerType: row.providerType,
  baseUrl: row.baseUrl,
  apiKey: decryptSecret({
    ciphertext: row.credentialCiphertext,
    iv: row.credentialIv,
    authTag: row.credentialAuthTag,
    keyVersion: row.credentialKeyVersion,
  }),
});

export const queryProviderChatApiConnectionByOwner = async (providerId: string, ownerId: string): Promise<ProviderApiConnection | undefined> => {
  const result = await query<ProviderConnectionRow>(
    `
      SELECT
        p."providerType",
        p."baseUrl",
        p."credentialCiphertext",
        p."credentialIv",
        p."credentialAuthTag",
        p."credentialKeyVersion"
      FROM "provider" p
      JOIN "providerChat" pc ON pc."provider" = p."id"
      WHERE p."id" = $1
        AND p."owner" = $2
    `,
    [providerId, ownerId],
  );

  const row = result.rows[0];

  return row ? connectionFromRow(row) : undefined;
};

export type ProviderEmbedderApiConnection = ProviderApiConnection & ProviderEmbedderUpdate;

export const queryProviderEmbedderApiConnectionByOwner = async (providerId: string, ownerId: string): Promise<ProviderEmbedderApiConnection | undefined> => {
  const result = await query<ProviderConnectionRow & ProviderEmbedderUpdate>(
    `
      SELECT
        p."providerType",
        p."baseUrl",
        p."credentialCiphertext",
        p."credentialIv",
        p."credentialAuthTag",
        p."credentialKeyVersion",
        pe."model"
      FROM "provider" p
      JOIN "providerEmbedder" pe ON pe."provider" = p."id"
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
    ...connectionFromRow(row),
    model: row.model,
  };
};

export const queryProviderCredential = async (providerId: string, requesterId: string, loopId?: string): Promise<string | undefined> => {
  const result = await query<{ credentialCiphertext: string; credentialIv: string; credentialAuthTag: string; credentialKeyVersion: string }>(
    `
      SELECT
        p."credentialCiphertext",
        p."credentialIv",
        p."credentialAuthTag",
        p."credentialKeyVersion"
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
