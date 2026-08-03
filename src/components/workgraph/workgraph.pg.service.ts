import { getPool } from "@components/postgres/postgres.js";
import { decryptSecret, encryptSecret } from "@components/utilities/secret-envelope.js";
import type { LoopWorkgraph, LoopWorkgraphAdminUpdate, Workgraph, WorkgraphInsert, WorkgraphUpdate } from "./workgraph.schema.js";

const workgraphColumns = `"id", "owner", "name", "type", "baseUrl", "projectKey", "email", "lifecycleStatus", "createdAt", "updatedAt"`;

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
        "projectKey",
        "email",
        "credentialCiphertext",
        "credentialIv",
        "credentialAuthTag",
        "credentialKeyVersion",
        "lifecycleStatus"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING ${workgraphColumns}
    `,
    [ownerId, input.name, input.type, input.baseUrl, input.projectKey, input.email, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, input.lifecycleStatus],
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
          "projectKey" = $4,
          "email" = $5,
          "lifecycleStatus" = $6,
          "credentialCiphertext" = $7,
          "credentialIv" = $8,
          "credentialAuthTag" = $9,
          "credentialKeyVersion" = $10
        WHERE "id" = $11
          AND "owner" = $12
        RETURNING ${workgraphColumns}
      `,
      [input.name, input.type, input.baseUrl, input.projectKey, input.email, input.lifecycleStatus, envelope.ciphertext, envelope.iv, envelope.authTag, envelope.keyVersion, workgraphId, ownerId],
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
        "projectKey" = $4,
        "lifecycleStatus" = $5
      WHERE "id" = $6
        AND "owner" = $7
      RETURNING ${workgraphColumns}
    `,
    [input.name, input.type, input.baseUrl, input.projectKey, input.lifecycleStatus, workgraphId, ownerId],
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
        lw."loop",
        lw."workgraph",
        w."owner",
        lw."enabled",
        lw."seedItems",
        lw."hierarchyRules",
        lw."assignmentOverrides",
        lw."lastSyncedAt",
        lw."lastSyncStatus",
        lw."lastSyncError",
        lw."createdAt",
        lw."updatedAt",
        w."name",
        w."type",
        w."baseUrl",
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
        "seedItems" = COALESCE($2::jsonb, "seedItems"),
        "hierarchyRules" = COALESCE($3::jsonb, "hierarchyRules"),
        "assignmentOverrides" = COALESCE($4::jsonb, "assignmentOverrides")
      WHERE "loop" = $5
        AND "workgraph" = $6
      RETURNING 1
    `,
    [
      input.enabled ?? null,
      input.seedItems ? JSON.stringify(input.seedItems) : null,
      input.hierarchyRules ? JSON.stringify(input.hierarchyRules) : null,
      input.assignmentOverrides ? JSON.stringify(input.assignmentOverrides) : null,
      loopId,
      workgraphId,
    ],
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
