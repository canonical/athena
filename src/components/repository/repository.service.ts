import { query } from "@components/postgres/postgres.js";
import { decryptSecret, encryptSecret } from "@components/utilities/secret-envelope.js";
import type { LoopRepository, Repository, RepositoryInsert, RepositoryUpdate } from "./repository.schema.js";

const repositoryColumns = `"id", "owner", "displayName", "repositoryType", "apiBaseUrl", "repositoryOwner", "repositoryName", "defaultBranch", "lifecycleStatus", "createdAt", "updatedAt"`;

export const queryRepositoryListByOwner = async (ownerId: string): Promise<Repository[]> => {
  const result = await query<Repository>(
    `
      SELECT ${repositoryColumns}, TRUE AS "hasCredential"
      FROM "repository"
      WHERE "owner" = $1
      ORDER BY "createdAt" ASC, "id" ASC
    `,
    [ownerId],
  );

  return result.rows;
};

export const queryRepositoryByIdForOwner = async (repositoryId: string, ownerId: string): Promise<Repository | undefined> => {
  const result = await query<Repository>(
    `
      SELECT ${repositoryColumns}, TRUE AS "hasCredential"
      FROM "repository"
      WHERE "id" = $1
        AND "owner" = $2
    `,
    [repositoryId, ownerId],
  );

  return result.rows[0];
};

export const queryRepositoryCreate = async (input: RepositoryInsert, ownerId: string): Promise<Repository> => {
  const envelope = encryptSecret(input.apiKey);

  const result = await query<Repository>(
    `
      INSERT INTO "repository" (
        "owner",
        "displayName",
        "repositoryType",
        "apiBaseUrl",
        "repositoryOwner",
        "repositoryName",
        "defaultBranch",
        "credentialCiphertext",
        "credentialIv",
        "credentialAuthTag",
        "credentialKeyVersion",
        "lifecycleStatus"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING ${repositoryColumns}, TRUE AS "hasCredential"
    `,
    [
      ownerId,
      input.displayName,
      input.repositoryType,
      input.apiBaseUrl,
      input.repositoryOwner,
      input.repositoryName,
      input.defaultBranch ?? null,
      envelope.ciphertext,
      envelope.iv,
      envelope.authTag,
      envelope.keyVersion,
      input.lifecycleStatus,
    ],
  );

  const repository = result.rows[0];

  if (!repository) {
    throw new Error(`Repository was not created.`);
  }

  return repository;
};

export const queryRepositoryUpdate = async (repositoryId: string, ownerId: string, input: RepositoryUpdate): Promise<Repository | undefined> => {
  if (input.apiKey) {
    const envelope = encryptSecret(input.apiKey);
    const result = await query<Repository>(
      `
        UPDATE "repository"
        SET
          "displayName" = $1,
          "repositoryType" = $2,
          "apiBaseUrl" = $3,
          "repositoryOwner" = $4,
          "repositoryName" = $5,
          "defaultBranch" = $6,
          "lifecycleStatus" = $7,
          "credentialCiphertext" = $8,
          "credentialIv" = $9,
          "credentialAuthTag" = $10,
          "credentialKeyVersion" = $11
        WHERE "id" = $12
          AND "owner" = $13
        RETURNING ${repositoryColumns}, TRUE AS "hasCredential"
      `,
      [
        input.displayName,
        input.repositoryType,
        input.apiBaseUrl,
        input.repositoryOwner,
        input.repositoryName,
        input.defaultBranch ?? null,
        input.lifecycleStatus,
        envelope.ciphertext,
        envelope.iv,
        envelope.authTag,
        envelope.keyVersion,
        repositoryId,
        ownerId,
      ],
    );

    return result.rows[0];
  }

  const result = await query<Repository>(
    `
      UPDATE "repository"
      SET
        "displayName" = $1,
        "repositoryType" = $2,
        "apiBaseUrl" = $3,
        "repositoryOwner" = $4,
        "repositoryName" = $5,
        "defaultBranch" = $6,
        "lifecycleStatus" = $7
      WHERE "id" = $8
        AND "owner" = $9
      RETURNING ${repositoryColumns}, TRUE AS "hasCredential"
    `,
    [input.displayName, input.repositoryType, input.apiBaseUrl, input.repositoryOwner, input.repositoryName, input.defaultBranch ?? null, input.lifecycleStatus, repositoryId, ownerId],
  );

  return result.rows[0];
};

export const queryRepositoryDelete = async (repositoryId: string, ownerId: string): Promise<boolean> => {
  const result = await query(`DELETE FROM "repository" WHERE "id" = $1 AND "owner" = $2`, [repositoryId, ownerId]);

  return Boolean(result.rowCount);
};

export const queryLoopRepositoryList = async (loopId: string): Promise<LoopRepository[]> => {
  const result = await query<LoopRepository>(
    `
      SELECT
        lr."loop",
        lr."repository",
        r."owner",
        lr."enabled",
        lr."createdAt",
        lr."updatedAt",
        r."displayName",
        r."repositoryType",
        r."apiBaseUrl",
        r."repositoryOwner",
        r."repositoryName",
        r."defaultBranch",
        r."lifecycleStatus"
      FROM "loopRepository" lr
      JOIN "repository" r ON r."id" = lr."repository"
      WHERE lr."loop" = $1
      ORDER BY lr."createdAt" ASC, lr."repository" ASC
    `,
    [loopId],
  );

  return result.rows;
};

export const queryLoopRepositoryAssign = async (loopId: string, repositoryId: string): Promise<void> => {
  await query(
    `
      INSERT INTO "loopRepository" ("loop", "repository")
      VALUES ($1, $2)
      ON CONFLICT ("loop", "repository") DO NOTHING
    `,
    [loopId, repositoryId],
  );
};

export const queryLoopRepositoryDelete = async (loopId: string, repositoryId: string): Promise<boolean> => {
  const result = await query(`DELETE FROM "loopRepository" WHERE "loop" = $1 AND "repository" = $2`, [loopId, repositoryId]);

  return Boolean(result.rowCount);
};

export type RepositoryApiConnection = {
  repositoryId: string;
  displayName: string;
  repositoryType: string;
  apiBaseUrl: string;
  repositoryOwner: string;
  repositoryName: string;
  defaultBranch: string | null;
  apiKey: string;
};

export const queryRepositoryApiConnectionByOwner = async (repositoryId: string, ownerId: string): Promise<RepositoryApiConnection | undefined> => {
  const result = await query<{
    repositoryId: string;
    displayName: string;
    repositoryType: string;
    apiBaseUrl: string;
    repositoryOwner: string;
    repositoryName: string;
    defaultBranch: string | null;
    credentialCiphertext: string;
    credentialIv: string;
    credentialAuthTag: string;
    credentialKeyVersion: string;
  }>(
    `
      SELECT
        r."id" AS "repositoryId",
        r."displayName",
        r."repositoryType",
        r."apiBaseUrl",
        r."repositoryOwner",
        r."repositoryName",
        r."defaultBranch",
        r."credentialCiphertext",
        r."credentialIv",
        r."credentialAuthTag",
        r."credentialKeyVersion"
      FROM "repository" r
      WHERE r."id" = $1
        AND r."owner" = $2
    `,
    [repositoryId, ownerId],
  );

  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  return {
    repositoryId: row.repositoryId,
    displayName: row.displayName,
    repositoryType: row.repositoryType,
    apiBaseUrl: row.apiBaseUrl,
    repositoryOwner: row.repositoryOwner,
    repositoryName: row.repositoryName,
    defaultBranch: row.defaultBranch,
    apiKey: decryptSecret({
      ciphertext: row.credentialCiphertext,
      iv: row.credentialIv,
      authTag: row.credentialAuthTag,
      keyVersion: row.credentialKeyVersion,
    }),
  };
};

export const queryLoopRepositoryApiConnectionList = async (loopId: string): Promise<RepositoryApiConnection[]> => {
  const result = await query<{
    repositoryId: string;
    displayName: string;
    repositoryType: string;
    apiBaseUrl: string;
    repositoryOwner: string;
    repositoryName: string;
    defaultBranch: string | null;
    credentialCiphertext: string;
    credentialIv: string;
    credentialAuthTag: string;
    credentialKeyVersion: string;
  }>(
    `
      SELECT
        r."id" AS "repositoryId",
        r."displayName",
        r."repositoryType",
        r."apiBaseUrl",
        r."repositoryOwner",
        r."repositoryName",
        r."defaultBranch",
        r."credentialCiphertext",
        r."credentialIv",
        r."credentialAuthTag",
        r."credentialKeyVersion"
      FROM "loopRepository" lr
      JOIN "repository" r ON r."id" = lr."repository"
      WHERE lr."loop" = $1
        AND lr."enabled" = TRUE
        AND r."lifecycleStatus" = 'active'
      ORDER BY lr."createdAt" ASC, r."createdAt" ASC
    `,
    [loopId],
  );

  return result.rows.map((row) => ({
    repositoryId: row.repositoryId,
    displayName: row.displayName,
    repositoryType: row.repositoryType,
    apiBaseUrl: row.apiBaseUrl,
    repositoryOwner: row.repositoryOwner,
    repositoryName: row.repositoryName,
    defaultBranch: row.defaultBranch,
    apiKey: decryptSecret({
      ciphertext: row.credentialCiphertext,
      iv: row.credentialIv,
      authTag: row.credentialAuthTag,
      keyVersion: row.credentialKeyVersion,
    }),
  }));
};

export const queryLoopRepositoryApiConnection = async (loopId: string): Promise<RepositoryApiConnection | undefined> => {
  const connections = await queryLoopRepositoryApiConnectionList(loopId);
  return connections[0];
};
