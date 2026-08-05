import { getPool } from "@components/postgres/postgres.js";
import { decryptSecret, encryptSecret } from "@components/utilities/secret-envelope.js";
import type { LoopWorkgraphWebhook, LoopWorkgraphWebhookUpdate } from "@components/webhook/webhook.schema.js";
import type { JiraSyncedItem } from "./workgraph.jira.service.js";
import type {
  LoopWorkgraph,
  LoopWorkgraphAdminUpdate,
  LoopWorkgraphItem,
  Workgraph,
  WorkgraphInsert,
  WorkgraphUpdate,
} from "./workgraph.schema.js";

const workgraphColumns = `"id", "owner", "name", "type", "baseUrl", "browseBaseUrl", "projectKey", "email", "lifecycleStatus", "createdAt", "updatedAt"`;

export const queryWorkgraphListByOwner = async (ownerId: string): Promise<Workgraph[]> => {
  const result = await getPool().query<Workgraph>(
    `
      SELECT ${workgraphColumns}
      FROM "workgraph"
      WHERE "owner" = $1
      ORDER BY "createdAt" ASC, "id" ASC
    `,
    [ownerId],
  );

  return result.rows;
};

export const queryWorkgraphByIdForOwner = async (workgraphId: string, ownerId: string): Promise<Workgraph | undefined> => {
  const result = await getPool().query<Workgraph>(
    `
      SELECT ${workgraphColumns}
      FROM "workgraph"
      WHERE "id" = $1
        AND "owner" = $2
    `,
    [workgraphId, ownerId],
  );

  return result.rows[0];
};

export const queryWorkgraphCreate = async (input: WorkgraphInsert, ownerId: string): Promise<Workgraph> => {
  const envelope = encryptSecret(input.apiKey);

  const result = await getPool().query<Workgraph>(
    `
      INSERT INTO "workgraph" (
        "owner",
        "name",
        "type",
        "baseUrl",
        "browseBaseUrl",
        "projectKey",
        "email",
        "credentialCiphertext",
        "credentialIv",
        "credentialAuthTag",
        "credentialKeyVersion",
        "lifecycleStatus"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING ${workgraphColumns}
    `,
    [ownerId, input.name, input.type, input.baseUrl, input.browseBaseUrl, input.projectKey, input.email, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, input.lifecycleStatus],
  );

  const workgraph = result.rows[0];

  if (!workgraph) {
    throw new Error(`Workgraph was not created.`);
  }

  return workgraph;
};

export const queryWorkgraphUpdate = async (workgraphId: string, ownerId: string, input: WorkgraphUpdate): Promise<Workgraph | undefined> => {
  if (input.apiKey) {
    const envelope = encryptSecret(input.apiKey);
    const result = await getPool().query<Workgraph>(
      `
        UPDATE "workgraph"
        SET
          "name" = $1,
          "type" = $2,
          "baseUrl" = $3,
          "browseBaseUrl" = $4,
          "projectKey" = $5,
          "email" = $6,
          "lifecycleStatus" = $7,
          "credentialCiphertext" = $8,
          "credentialIv" = $9,
          "credentialAuthTag" = $10,
          "credentialKeyVersion" = $11
        WHERE "id" = $12
          AND "owner" = $13
        RETURNING ${workgraphColumns}
      `,
      [input.name, input.type, input.baseUrl, input.browseBaseUrl, input.projectKey, input.email, input.lifecycleStatus, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, workgraphId, ownerId],
    );

    return result.rows[0];
  }

  const result = await getPool().query<Workgraph>(
    `
      UPDATE "workgraph"
      SET
        "name" = $1,
        "type" = $2,
        "baseUrl" = $3,
        "browseBaseUrl" = $4,
        "projectKey" = $5,
        "lifecycleStatus" = $6
      WHERE "id" = $7
        AND "owner" = $8
      RETURNING ${workgraphColumns}
    `,
    [input.name, input.type, input.baseUrl, input.browseBaseUrl, input.projectKey, input.lifecycleStatus, workgraphId, ownerId],
  );

  return result.rows[0];
};

export const queryWorkgraphDelete = async (workgraphId: string, ownerId: string): Promise<boolean> => {
  const result = await getPool().query(`DELETE FROM "workgraph" WHERE "id" = $1 AND "owner" = $2`, [workgraphId, ownerId]);

  return Boolean(result.rowCount);
};

export const queryLoopWorkgraphList = async (loopId: string): Promise<LoopWorkgraph[]> => {
  const result = await getPool().query<LoopWorkgraph>(
    `
      SELECT
        lw."id",
        lw."loop",
        lw."workgraph",
        w."owner",
        lw."enabled",
        lw."assignmentConfig",
        lw."lastSyncedAt",
        lw."lastSyncStatus",
        lw."lastSyncError",
        lw."createdAt",
        lw."updatedAt",
        w."name",
        w."type",
        w."baseUrl",
        w."browseBaseUrl",
        w."projectKey"
      FROM "loopWorkgraph" lw
      JOIN "workgraph" w ON w."id" = lw."workgraph"
      WHERE lw."loop" = $1
      ORDER BY lw."createdAt" ASC, lw."workgraph" ASC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryLoopWorkgraphAssign = async (loopId: string, workgraphId: string): Promise<void> => {
  await getPool().query(
    `
      INSERT INTO "loopWorkgraph" ("loop", "workgraph")
      VALUES ($1, $2)
      ON CONFLICT ("loop", "workgraph") DO NOTHING
    `,
    [loopId, workgraphId],
  );
};

export const queryLoopWorkgraphUpdateByAdmin = async (loopId: string, workgraphId: string, input: LoopWorkgraphAdminUpdate): Promise<LoopWorkgraph | undefined> => {
  const result = await getPool().query(
    `
      UPDATE "loopWorkgraph"
      SET
        "enabled" = COALESCE($1, "enabled"),
        "assignmentConfig" = COALESCE($2::jsonb, "assignmentConfig")
      WHERE "loop" = $3
        AND "workgraph" = $4
      RETURNING 1
    `,
    [input.enabled ?? null, input.assignmentConfig ? JSON.stringify(input.assignmentConfig) : null, loopId, workgraphId],
  );

  if (!result.rowCount) {
    return undefined;
  }

  const assignments = await queryLoopWorkgraphList(loopId);
  return assignments.find((assignment) => assignment.workgraph === workgraphId);
};

export const queryLoopWorkgraphDelete = async (loopId: string, workgraphId: string): Promise<boolean> => {
  const result = await getPool().query(`DELETE FROM "loopWorkgraph" WHERE "loop" = $1 AND "workgraph" = $2`, [loopId, workgraphId]);

  return Boolean(result.rowCount);
};

type WorkgraphApiConnection = {
  type: string;
  baseUrl: string;
  projectKey: string | null;
  email: string;
  apiKey: string;
};

export const queryWorkgraphApiConnectionByOwner = async (workgraphId: string, ownerId: string): Promise<WorkgraphApiConnection | undefined> => {
  const result = await getPool().query<{
    type: string;
    baseUrl: string;
    projectKey: string | null;
    email: string;
    credentialCiphertext: string;
    credentialIv: string;
    credentialAuthTag: string;
    credentialKeyVersion: string;
  }>(
    `
      SELECT
        w."type",
        w."baseUrl",
        w."projectKey",
        w."email",
        w."credentialCiphertext",
        w."credentialIv",
        w."credentialAuthTag",
        w."credentialKeyVersion"
      FROM "workgraph" w
      WHERE w."id" = $1
        AND w."owner" = $2
    `,
    [workgraphId, ownerId],
  );

  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  return {
    type: row.type,
    baseUrl: row.baseUrl,
    projectKey: row.projectKey,
    email: row.email,
    apiKey: decryptSecret({
      ciphertext: row.credentialCiphertext,
      iv: row.credentialIv,
      authTag: row.credentialAuthTag,
      keyVersion: row.credentialKeyVersion,
    }),
  };
};

export type LoopWorkgraphSyncConnection = {
  loop: string;
  workgraph: string;
  type: string;
  baseUrl: string;
  browseBaseUrl: string | null;
  projectKey: string | null;
  email: string;
  apiKey: string;
  assignmentConfig: Record<string, unknown>;
  enabled: boolean;
};

export const queryLoopWorkgraphSyncConnection = async (loopId: string, workgraphId: string): Promise<LoopWorkgraphSyncConnection | undefined> => {
  const result = await getPool().query<{
    loop: string;
    workgraph: string;
    type: string;
    baseUrl: string;
    browseBaseUrl: string | null;
    projectKey: string | null;
    email: string;
    assignmentConfig: Record<string, unknown>;
    enabled: boolean;
    credentialCiphertext: string;
    credentialIv: string;
    credentialAuthTag: string;
    credentialKeyVersion: string;
  }>(
    `
      SELECT
        lw."loop",
        lw."workgraph",
        lw."assignmentConfig",
        lw."enabled",
        w."type",
        w."baseUrl",
        w."browseBaseUrl",
        w."projectKey",
        w."email",
        w."credentialCiphertext",
        w."credentialIv",
        w."credentialAuthTag",
        w."credentialKeyVersion"
      FROM "loopWorkgraph" lw
      JOIN "workgraph" w ON w."id" = lw."workgraph"
      WHERE lw."loop" = $1
        AND lw."workgraph" = $2
    `,
    [loopId, workgraphId],
  );

  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  return {
    loop: row.loop,
    workgraph: row.workgraph,
    type: row.type,
    baseUrl: row.baseUrl,
    browseBaseUrl: row.browseBaseUrl,
    projectKey: row.projectKey,
    email: row.email,
    assignmentConfig: row.assignmentConfig,
    enabled: row.enabled,
    apiKey: decryptSecret({
      ciphertext: row.credentialCiphertext,
      iv: row.credentialIv,
      authTag: row.credentialAuthTag,
      keyVersion: row.credentialKeyVersion,
    }),
  };
};

export const queryLoopWorkgraphMarkSyncFailed = async (loopId: string, workgraphId: string, errorMessage: string): Promise<void> => {
  await getPool().query(
    `
      UPDATE "loopWorkgraph"
      SET
        "lastSyncedAt" = NOW(),
        "lastSyncStatus" = 'failed',
        "lastSyncError" = $3
      WHERE "loop" = $1
        AND "workgraph" = $2
    `,
    [loopId, workgraphId, errorMessage],
  );
};

export const queryLoopWorkgraphMarkSynchronizing = async (loopId: string, workgraphId: string): Promise<boolean> => {
  const result = await getPool().query(
    `
      UPDATE "loopWorkgraph"
      SET
        "lastSyncStatus" = 'synchronizing',
        "lastSyncError" = NULL
      WHERE "loop" = $1
        AND "workgraph" = $2
        AND "lastSyncStatus" <> 'synchronizing'
      RETURNING 1
    `,
    [loopId, workgraphId],
  );

  return Boolean(result.rowCount);
};

export const queryLoopWorkgraphReplaceItems = async (loopId: string, workgraphId: string, items: JiraSyncedItem[]): Promise<void> => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query(`BEGIN`);

    const loopWorkgraphResult = await client.query<{ id: string }>(
      `
        SELECT "id"
        FROM "loopWorkgraph"
        WHERE "loop" = $1
          AND "workgraph" = $2
        LIMIT 1
      `,
      [loopId, workgraphId],
    );

    const loopWorkgraphId = loopWorkgraphResult.rows[0]?.id;

    if (!loopWorkgraphId) {
      throw new Error(`Loop workgraph not found.`);
    }

    if (items.length > 0) {
      const itemKeys = items.map((item) => item.itemKey);
      const itemIds = items.map((item) => item.itemId);
      const parentKeys = items.map((item) => item.parentKey);
      const titles = items.map((item) => item.title);
      const itemTypes = items.map((item) => item.itemType);
      const statuses = items.map((item) => item.status);
      const webUrls = items.map((item) => item.webUrl);
      const payloads = items.map((item) => JSON.stringify(item.payload ?? {}));

      await client.query(
        `
          INSERT INTO "loopWorkgraphItem" (
            "loopWorkgraph",
            "itemKey",
            "itemId",
            "parentKey",
            "title",
            "itemType",
            "status",
            "webUrl",
            "payload"
          )
          SELECT
            $1,
            src."itemKey",
            src."itemId",
            src."parentKey",
            src."title",
            src."itemType",
            src."status",
            src."webUrl",
            src."payload"::jsonb
          FROM unnest(
            $2::text[],
            $3::text[],
            $4::text[],
            $5::text[],
            $6::text[],
            $7::text[],
            $8::text[],
            $9::text[]
          ) AS src("itemKey", "itemId", "parentKey", "title", "itemType", "status", "webUrl", "payload")
          ON CONFLICT ("loopWorkgraph", "itemKey")
          DO UPDATE SET
            "itemId" = EXCLUDED."itemId",
            "parentKey" = EXCLUDED."parentKey",
            "title" = EXCLUDED."title",
            "itemType" = EXCLUDED."itemType",
            "status" = EXCLUDED."status",
            "webUrl" = EXCLUDED."webUrl",
            "payload" = EXCLUDED."payload",
            "syncedAt" = NOW(),
            "updatedAt" = NOW()
        `,
        [loopWorkgraphId, itemKeys, itemIds, parentKeys, titles, itemTypes, statuses, webUrls, payloads],
      );
    }

    await client.query(
      `
        UPDATE "loopWorkgraph"
        SET
          "lastSyncedAt" = NOW(),
          "lastSyncStatus" = 'synchronized',
          "lastSyncError" = NULL
        WHERE "loop" = $1
          AND "workgraph" = $2
      `,
      [loopId, workgraphId],
    );

    await client.query(`COMMIT`);
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

export const queryLoopWorkgraphItemList = async (loopId: string, workgraphId: string): Promise<LoopWorkgraphItem[]> => {
  const result = await getPool().query<LoopWorkgraphItem>(
    `
      SELECT
        lwi."id",
        lwi."loopWorkgraph",
        lw."loop",
        lw."workgraph",
        lwi."itemKey",
        lwi."itemId",
        lwi."parentKey",
        lwi."title",
        lwi."itemType",
        lwi."status",
        lwi."webUrl",
        lwi."payload",
        lwi."syncedAt",
        lwi."createdAt",
        lwi."updatedAt"
      FROM "loopWorkgraphItem" lwi
      JOIN "loopWorkgraph" lw ON lw."id" = lwi."loopWorkgraph"
      WHERE lw."loop" = $1
        AND lw."workgraph" = $2
      ORDER BY lwi."parentKey" NULLS FIRST, lwi."itemType" ASC, lwi."itemKey" ASC
    `,
    [loopId, workgraphId],
  );

  return result.rows;
};

export const queryLoopWorkgraphItemById = async (loopId: string, workgraphId: string, itemId: string): Promise<LoopWorkgraphItem | undefined> => {
  const result = await getPool().query<LoopWorkgraphItem>(
    `
      SELECT
        lwi."id",
        lwi."loopWorkgraph",
        lw."loop",
        lw."workgraph",
        lwi."itemKey",
        lwi."itemId",
        lwi."parentKey",
        lwi."title",
        lwi."itemType",
        lwi."status",
        lwi."webUrl",
        lwi."payload",
        lwi."syncedAt",
        lwi."createdAt",
        lwi."updatedAt"
      FROM "loopWorkgraphItem" lwi
      JOIN "loopWorkgraph" lw ON lw."id" = lwi."loopWorkgraph"
      WHERE lw."loop" = $1
        AND lw."workgraph" = $2
        AND lwi."id" = $3
      LIMIT 1
    `,
    [loopId, workgraphId, itemId],
  );

  return result.rows[0];
};

export const queryLoopWorkgraphId = async (loopId: string, workgraphId: string): Promise<string | undefined> => {
  const result = await getPool().query<{ id: string }>(
    `
      SELECT "id"
      FROM "loopWorkgraph"
      WHERE "loop" = $1
        AND "workgraph" = $2
    `,
    [loopId, workgraphId],
  );

  return result.rows[0]?.id;
};

export const queryLoopWorkgraphWebhookList = async (loopWorkgraphId: string): Promise<LoopWorkgraphWebhook[]> => {
  const result = await getPool().query<LoopWorkgraphWebhook>(
    `
      SELECT
        "id",
        "label",
        "receiverId",
        "type",
        "loopWorkgraph",
        "authHeaderName",
        "securityMode",
        "securityConfig",
        "active",
        "createdAt",
        "updatedAt"
      FROM "webhook"
      WHERE "loopWorkgraph" = $1
      ORDER BY "createdAt" ASC, "id" ASC
    `,
    [loopWorkgraphId],
  );

  return result.rows;
};

export const queryLoopWorkgraphWebhookCreate = async (input: {
  loopWorkgraphId: string;
  label: string;
  receiverId: string;
  authHeaderName: string;
  authSecretHash: string;
}): Promise<LoopWorkgraphWebhook> => {
  const result = await getPool().query<LoopWorkgraphWebhook>(
    `
      INSERT INTO "webhook" (
        "label",
        "receiverId",
        "type",
        "loopWorkgraph",
        "authHeaderName",
        "authSecretHash",
        "securityMode",
        "securityConfig",
        "active"
      )
      VALUES ($1, $2, 'workgraph', $3, $4, $5, 'header', '{}'::jsonb, TRUE)
      RETURNING
        "id",
        "label",
        "receiverId",
        "type",
        "loopWorkgraph",
        "authHeaderName",
        "securityMode",
        "securityConfig",
        "active",
        "createdAt",
        "updatedAt"
    `,
    [input.label, input.receiverId, input.loopWorkgraphId, input.authHeaderName, input.authSecretHash],
  );

  const webhook = result.rows[0];

  if (!webhook) {
    throw new Error(`Webhook was not created.`);
  }

  return webhook;
};

export const queryLoopWorkgraphWebhookUpdate = async (webhookId: string, loopWorkgraphId: string, input: LoopWorkgraphWebhookUpdate): Promise<LoopWorkgraphWebhook | undefined> => {
  const result = await getPool().query<LoopWorkgraphWebhook>(
    `
      UPDATE "webhook"
      SET
        "label" = COALESCE($1, "label"),
        "authHeaderName" = COALESCE($2, "authHeaderName"),
        "active" = COALESCE($3, "active")
      WHERE "id" = $4
        AND "loopWorkgraph" = $5
      RETURNING
        "id",
        "label",
        "receiverId",
        "type",
        "loopWorkgraph",
        "authHeaderName",
        "securityMode",
        "securityConfig",
        "active",
        "createdAt",
        "updatedAt"
    `,
    [input.label ?? null, input.authHeaderName ?? null, input.active ?? null, webhookId, loopWorkgraphId],
  );

  return result.rows[0];
};

export const queryLoopWorkgraphWebhookDelete = async (webhookId: string, loopWorkgraphId: string): Promise<boolean> => {
  const result = await getPool().query(
    `
      DELETE FROM "webhook"
      WHERE "id" = $1
        AND "loopWorkgraph" = $2
    `,
    [webhookId, loopWorkgraphId],
  );

  return Boolean(result.rowCount);
};

export const queryWebhookByReceiverId = async (receiverId: string): Promise<
  | {
      id: string;
      type: string;
      loop: string;
      workgraph: string;
      assignmentConfig: Record<string, unknown>;
      baseUrl: string;
      email: string;
      apiKey: string;
      browseBaseUrl: string | null;
      authHeaderName: string;
      authSecretHash: string;
      active: boolean;
    }
  | undefined
> => {
  const result = await getPool().query<{
    id: string;
    type: string;
    loop: string;
    workgraph: string;
    assignmentConfig: Record<string, unknown>;
    baseUrl: string;
    email: string;
    credentialCiphertext: string;
    credentialIv: string;
    credentialAuthTag: string;
    credentialKeyVersion: string;
    browseBaseUrl: string | null;
    authHeaderName: string;
    authSecretHash: string;
    active: boolean;
  }>(
    `
      SELECT
        wh."id",
        wh."type",
        lw."loop",
        lw."workgraph",
        lw."assignmentConfig",
        w."baseUrl",
        w."email",
        w."credentialCiphertext",
        w."credentialIv",
        w."credentialAuthTag",
        w."credentialKeyVersion",
        w."browseBaseUrl",
        wh."authHeaderName",
        wh."authSecretHash",
        wh."active"
      FROM "webhook" wh
      JOIN "loopWorkgraph" lw ON lw."id" = wh."loopWorkgraph"
      JOIN "workgraph" w ON w."id" = lw."workgraph"
      WHERE wh."receiverId" = $1
    `,
    [receiverId],
  );

  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  return {
    id: row.id,
    type: row.type,
    loop: row.loop,
    workgraph: row.workgraph,
    assignmentConfig: row.assignmentConfig,
    baseUrl: row.baseUrl,
    email: row.email,
    apiKey: decryptSecret({
      ciphertext: row.credentialCiphertext,
      iv: row.credentialIv,
      authTag: row.credentialAuthTag,
      keyVersion: row.credentialKeyVersion,
    }),
    browseBaseUrl: row.browseBaseUrl,
    authHeaderName: row.authHeaderName,
    authSecretHash: row.authSecretHash,
    active: row.active,
  };
};

export const queryWebhookItemCreate = async (payload: Record<string, unknown>): Promise<void> => {
  await getPool().query(
    `
      INSERT INTO "webhookItem" (
        "payload",
        "status",
        "retryCount"
      )
      VALUES ($1::jsonb, 'new', 0)
    `,
    [JSON.stringify(payload)],
  );
};

export const queryWebhookItemClaimNext = async (): Promise<{ id: string; payload: Record<string, unknown>; retryCount: number } | undefined> => {
  const result = await getPool().query<{ id: string; payload: Record<string, unknown>; retryCount: number }>(
    `
      WITH candidate AS (
        SELECT wi."id"
        FROM "webhookItem" wi
        WHERE wi."status" = 'new'
          AND wi."retryCount" < 3
        ORDER BY wi."id" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "webhookItem" wi
      SET
        "status" = 'processing',
        "retryCount" = wi."retryCount" + 1
      FROM candidate
      WHERE wi."id" = candidate."id"
      RETURNING wi."id", wi."payload", wi."retryCount"
    `,
  );

  return result.rows[0];
};

export const queryWebhookItemMarkDone = async (id: string): Promise<void> => {
  await getPool().query(
    `
      UPDATE "webhookItem"
      SET "status" = 'done'
      WHERE "id" = $1
    `,
    [id],
  );
};

export const queryWebhookItemRequeue = async (id: string): Promise<void> => {
  await getPool().query(
    `
      UPDATE "webhookItem"
      SET "status" = 'new'
      WHERE "id" = $1
        AND "status" = 'processing'
    `,
    [id],
  );
};

export const queryLoopWorkgraphUpsertItem = async (input: {
  loopId: string;
  workgraphId: string;
  itemKey: string;
  itemId: string;
  parentKey: string | null;
  title: string;
  itemType: string;
  status: string | null;
  webUrl: string | null;
  payload: Record<string, unknown>;
}): Promise<void> => {
  const loopWorkgraphId = await queryLoopWorkgraphId(input.loopId, input.workgraphId);

  if (!loopWorkgraphId) {
    throw new Error(`Loop workgraph not found.`);
  }

  await getPool().query(
    `
      INSERT INTO "loopWorkgraphItem" (
        "loopWorkgraph",
        "itemKey",
        "itemId",
        "parentKey",
        "title",
        "itemType",
        "status",
        "webUrl",
        "payload"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      ON CONFLICT ("loopWorkgraph", "itemKey")
      DO UPDATE SET
        "itemId" = EXCLUDED."itemId",
        "parentKey" = EXCLUDED."parentKey",
        "title" = EXCLUDED."title",
        "itemType" = EXCLUDED."itemType",
        "status" = EXCLUDED."status",
        "webUrl" = EXCLUDED."webUrl",
        "payload" = EXCLUDED."payload",
        "syncedAt" = NOW()
    `,
    [loopWorkgraphId, input.itemKey, input.itemId, input.parentKey, input.title, input.itemType, input.status, input.webUrl, JSON.stringify(input.payload)],
  );
};
