import { HttpError } from "@components/express/express.errors.js";
import { queryLoopAdminMembership, queryLoopForUser, queryLoopMembership } from "@components/loop/loop.service.js";
import { isValidUuid } from "@components/utilities/zod.utilities.js";
import type { LoopRepository, LoopRepositoryAssign, Repository, RepositoryConnectionTest, RepositoryInsert, RepositoryUpdate } from "./repository.schema.js";
import {
  queryLoopRepositoryApiConnection,
  queryLoopRepositoryAssign,
  queryLoopRepositoryDelete,
  queryLoopRepositoryList,
  queryRepositoryApiConnectionByOwner,
  queryRepositoryByIdForOwner,
  queryRepositoryCreate,
  queryRepositoryDelete,
  queryRepositoryListByOwner,
  queryRepositoryUpdate,
} from "./repository.service.js";

class RepositoryNotFoundError extends HttpError {
  constructor() {
    super({ status: 404, message: `Repository not found.` });
  }
}

const ensureGithubOnly = (repositoryType: string): void => {
  if (repositoryType !== `github`) {
    throw new HttpError({ status: 400, message: `Only github repository type is supported in this phase.` });
  }
};

const validateLoopId = (loopId: string): void => {
  if (!isValidUuid(loopId)) {
    throw new HttpError({ status: 400, message: `loopId must be a valid UUID.` });
  }
};

const validateRepositoryId = (repositoryId: string): void => {
  if (!isValidUuid(repositoryId)) {
    throw new HttpError({ status: 400, message: `repositoryId must be a valid UUID.` });
  }
};

const readGithubError = async (response: Response): Promise<string | undefined> => {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;

  if (payload && typeof payload.message === `string` && payload.message.trim().length > 0) {
    return payload.message;
  }

  return undefined;
};

const testGithubRepositoryConnection = async (input: { apiBaseUrl: string; repositoryOwner: string; repositoryName: string; apiKey: string }): Promise<void> => {
  const endpoint = `${input.apiBaseUrl.replace(/\/+$/u, "")}/repos/${encodeURIComponent(input.repositoryOwner)}/${encodeURIComponent(input.repositoryName)}`;
  const response = await fetch(endpoint, {
    method: `GET`,
    headers: {
      Accept: `application/vnd.github+json`,
      Authorization: `Bearer ${input.apiKey}`,
      "X-GitHub-Api-Version": `2022-11-28`,
    },
  });

  if (!response.ok) {
    const detail = await readGithubError(response);
    if (response.status === 401 || response.status === 403) {
      throw new HttpError({ status: 400, message: detail ?? `GitHub authentication failed. Verify PAT scopes and repository access.` });
    }

    if (response.status === 404) {
      throw new HttpError({ status: 400, message: detail ?? `GitHub repository not found or inaccessible.` });
    }

    throw new HttpError({ status: 400, message: detail ?? `GitHub connection failed with status ${response.status}.` });
  }
};

export const repositoryList = async (ownerId: string): Promise<Repository[]> => {
  return queryRepositoryListByOwner(ownerId);
};

export const repositoryGet = async (repositoryId: string, ownerId: string): Promise<Repository> => {
  const repository = await queryRepositoryByIdForOwner(repositoryId, ownerId);

  if (!repository) {
    throw new RepositoryNotFoundError();
  }

  return repository;
};

export const repositoryCreate = async (input: RepositoryInsert, ownerId: string): Promise<Repository> => {
  ensureGithubOnly(input.repositoryType);
  return queryRepositoryCreate(input, ownerId);
};

export const repositoryUpdate = async (repositoryId: string, ownerId: string, input: RepositoryUpdate): Promise<Repository> => {
  ensureGithubOnly(input.repositoryType);
  const updated = await queryRepositoryUpdate(repositoryId, ownerId, input);

  if (!updated) {
    throw new RepositoryNotFoundError();
  }

  return updated;
};

export const repositoryDelete = async (repositoryId: string, ownerId: string): Promise<void> => {
  const deleted = await queryRepositoryDelete(repositoryId, ownerId);

  if (!deleted) {
    throw new RepositoryNotFoundError();
  }
};

export const repositoryTestConnection = async (input: RepositoryConnectionTest): Promise<{ ok: true; message: string }> => {
  ensureGithubOnly(input.repositoryType);

  await testGithubRepositoryConnection({
    apiBaseUrl: input.apiBaseUrl,
    repositoryOwner: input.repositoryOwner,
    repositoryName: input.repositoryName,
    apiKey: input.apiKey,
  });

  return {
    ok: true,
    message: `GitHub connection succeeded for ${input.repositoryOwner}/${input.repositoryName}.`,
  };
};

export const repositoryTestConnectionById = async (repositoryId: string, ownerId: string): Promise<{ ok: true; message: string }> => {
  const connection = await queryRepositoryApiConnectionByOwner(repositoryId, ownerId);

  if (!connection) {
    throw new RepositoryNotFoundError();
  }

  ensureGithubOnly(connection.repositoryType);

  await testGithubRepositoryConnection({
    apiBaseUrl: connection.apiBaseUrl,
    repositoryOwner: connection.repositoryOwner,
    repositoryName: connection.repositoryName,
    apiKey: connection.apiKey,
  });

  return {
    ok: true,
    message: `GitHub connection succeeded for ${connection.repositoryOwner}/${connection.repositoryName}.`,
  };
};

export const loopRepositoryList = async (loopId: string, userId: string): Promise<LoopRepository[]> => {
  validateLoopId(loopId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new RepositoryNotFoundError();
  }

  return queryLoopRepositoryList(loopId);
};

export const repositoryAssign = async (userId: string, input: LoopRepositoryAssign): Promise<void> => {
  validateLoopId(input.loop);
  validateRepositoryId(input.repository);

  if (!(await queryLoopMembership(input.loop, userId))) {
    throw new RepositoryNotFoundError();
  }

  const repository = await queryRepositoryByIdForOwner(input.repository, userId);

  if (!repository) {
    throw new RepositoryNotFoundError();
  }

  ensureGithubOnly(repository.repositoryType);

  await queryLoopRepositoryAssign(input.loop, input.repository);
};

export const loopRepositoryDelete = async (loopId: string, repositoryId: string, userId: string): Promise<void> => {
  validateLoopId(loopId);
  validateRepositoryId(repositoryId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new RepositoryNotFoundError();
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new HttpError({ status: 403, message: `Only loop admins may remove repository assignments.` });
  }

  if (!(await queryLoopRepositoryDelete(loopId, repositoryId))) {
    throw new RepositoryNotFoundError();
  }
};

export const loopRepositoryHasConnection = async (loopId: string): Promise<boolean> => {
  validateLoopId(loopId);

  const connection = await queryLoopRepositoryApiConnection(loopId);
  return Boolean(connection);
};
