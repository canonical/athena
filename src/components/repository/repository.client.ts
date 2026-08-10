import { authenticatedJsonDelete, authenticatedJsonGet, authenticatedJsonPost, authenticatedJsonPut } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { LoopRepository, Repository, RepositoryConnectionTest, RepositoryInsert, RepositoryUpdate } from "./repository.schema.js";

export const repositoryApiPaths = {
  list: getApiUrl(`/repository`),
  byId: (repositoryId: string) => getApiUrl(`/repository/${repositoryId}`),
  test: getApiUrl(`/repository/test`),
  testById: (repositoryId: string) => getApiUrl(`/repository/${repositoryId}/test`),
  loopList: (loopId: string) => getApiUrl(`/repository/loop/${loopId}/list`),
  assign: getApiUrl(`/repository/assign`),
  unassign: getApiUrl(`/repository/unassign`),
} as const;

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const fetchRepositoryList = async (): Promise<Repository[]> => {
  const response = await authenticatedJsonGet(repositoryApiPaths.list);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Repositories request failed with status ${response.status}`));
  }

  return response.json() as Promise<Repository[]>;
};

export const fetchRepositoryById = async (id: string): Promise<Repository> => {
  const response = await authenticatedJsonGet(repositoryApiPaths.byId(id));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Repository request failed with status ${response.status}`));
  }

  return response.json() as Promise<Repository>;
};

export const createRepository = async (payload: RepositoryInsert): Promise<Repository> => {
  const response = await authenticatedJsonPost(repositoryApiPaths.list, payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Repository creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Repository>;
};

export const updateRepository = async (repositoryId: string, payload: RepositoryUpdate): Promise<Repository> => {
  const response = await authenticatedJsonPut(repositoryApiPaths.byId(repositoryId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Repository update failed with status ${response.status}`));
  }

  return response.json() as Promise<Repository>;
};

export const testRepositoryConnection = async (payload: RepositoryConnectionTest): Promise<{ ok: true; message: string }> => {
  const response = await authenticatedJsonPost(repositoryApiPaths.test, payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Repository connection test failed with status ${response.status}`));
  }

  return response.json() as Promise<{ ok: true; message: string }>;
};

export const testRepositoryConnectionById = async (repositoryId: string): Promise<{ ok: true; message: string }> => {
  const response = await authenticatedJsonPost(repositoryApiPaths.testById(repositoryId), null);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Repository connection test failed with status ${response.status}`));
  }

  return response.json() as Promise<{ ok: true; message: string }>;
};

export const deleteRepository = async (repositoryId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(repositoryApiPaths.list, { body: { repository: repositoryId } });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Repository deletion failed with status ${response.status}`));
  }
};

export const fetchLoopRepositoryList = async (loopId: string): Promise<LoopRepository[]> => {
  const response = await authenticatedJsonGet(repositoryApiPaths.loopList(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop repositories request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopRepository[]>;
};

export const assignRepositoryToLoop = async (loopId: string, repositoryId: string): Promise<void> => {
  const response = await authenticatedJsonPost(repositoryApiPaths.assign, { loop: loopId, repository: repositoryId });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Repository assignment failed with status ${response.status}`));
  }
};

export const removeRepositoryFromLoop = async (loopId: string, repositoryId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(repositoryApiPaths.unassign, { body: { loop: loopId, repository: repositoryId } });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Repository removal failed with status ${response.status}`));
  }
};
