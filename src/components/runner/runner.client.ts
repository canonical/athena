import { authenticatedJsonDelete, authenticatedJsonGet, authenticatedJsonPost, authenticatedJsonPut } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { CopilotAgentTask } from "./runner.copilot.adapter.js";
import type { LoopRunner, LoopRunnerRepository, Runner, RunnerInsert, RunnerInstance, RunnerQueueItem, RunnerToken, RunnerTokenCreate, RunnerTokenCreated, RunnerUpdate } from "./runner.schema.js";

export type LoopRunnerSessionsResult = {
  queueItems: RunnerQueueItem[];
  githubTasks: CopilotAgentTask[];
  githubError: string | null;
};

export const runnerApiPaths = {
  list: getApiUrl(`/runner`),
  byId: (runnerId: string) => getApiUrl(`/runner/${runnerId}`),
  loopList: (loopId: string) => getApiUrl(`/runner/loop/${loopId}/list`),
  loopSessions: (loopId: string) => getApiUrl(`/runner/loop/${loopId}/sessions`),
  loopRunnerRepositories: (loopId: string, runnerId: string) => getApiUrl(`/runner/loop/${loopId}/${runnerId}/repositories`),
  assign: getApiUrl(`/runner/assign`),
  unassign: getApiUrl(`/runner/unassign`),
  tokens: (runnerId: string) => getApiUrl(`/runner/${runnerId}/tokens`),
  token: (runnerId: string, tokenId: string) => getApiUrl(`/runner/${runnerId}/tokens/${tokenId}`),
  instances: (runnerId: string) => getApiUrl(`/runner/${runnerId}/instances`),
} as const;

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const fetchRunnerTokens = async (runnerId: string): Promise<RunnerToken[]> => {
  const response = await authenticatedJsonGet(runnerApiPaths.tokens(runnerId));
  if (!response.ok) throw new Error(await readErrorMessage(response, `Runner tokens request failed with status ${response.status}`));
  return response.json() as Promise<RunnerToken[]>;
};

export const createRunnerToken = async (runnerId: string, payload: RunnerTokenCreate): Promise<RunnerTokenCreated> => {
  const response = await authenticatedJsonPost(runnerApiPaths.tokens(runnerId), payload);
  if (!response.ok) throw new Error(await readErrorMessage(response, `Runner token creation failed with status ${response.status}`));
  return response.json() as Promise<RunnerTokenCreated>;
};

export const revokeRunnerToken = async (runnerId: string, tokenId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(runnerApiPaths.token(runnerId, tokenId));
  if (!response.ok) throw new Error(await readErrorMessage(response, `Runner token revocation failed with status ${response.status}`));
};

export const fetchRunnerInstances = async (runnerId: string): Promise<RunnerInstance[]> => {
  const response = await authenticatedJsonGet(runnerApiPaths.instances(runnerId));
  if (!response.ok) throw new Error(await readErrorMessage(response, `Runner instances request failed with status ${response.status}`));
  return response.json() as Promise<RunnerInstance[]>;
};

export const fetchRunnerList = async (): Promise<Runner[]> => {
  const response = await authenticatedJsonGet(runnerApiPaths.list);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Runners request failed with status ${response.status}`));
  }

  return response.json() as Promise<Runner[]>;
};

export const fetchRunnerById = async (id: string): Promise<Runner> => {
  const response = await authenticatedJsonGet(runnerApiPaths.byId(id));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Runner request failed with status ${response.status}`));
  }

  return response.json() as Promise<Runner>;
};

export const createRunner = async (payload: RunnerInsert): Promise<Runner> => {
  const response = await authenticatedJsonPost(runnerApiPaths.list, payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Runner creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Runner>;
};

export const updateRunner = async (runnerId: string, payload: RunnerUpdate): Promise<Runner> => {
  const response = await authenticatedJsonPut(runnerApiPaths.byId(runnerId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Runner update failed with status ${response.status}`));
  }

  return response.json() as Promise<Runner>;
};

export const deleteRunner = async (runnerId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(runnerApiPaths.list, { body: { runner: runnerId } });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Runner deletion failed with status ${response.status}`));
  }
};

export const fetchLoopRunnerList = async (loopId: string): Promise<LoopRunner[]> => {
  const response = await authenticatedJsonGet(runnerApiPaths.loopList(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop runners request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopRunner[]>;
};

export const assignRunnerToLoop = async (loopId: string, runnerId: string, repositoryIds?: string[]): Promise<void> => {
  const response = await authenticatedJsonPost(runnerApiPaths.assign, { loop: loopId, runner: runnerId, repositoryIds });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Runner assignment failed with status ${response.status}`));
  }
};

export const removeRunnerFromLoop = async (loopId: string, runnerId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(runnerApiPaths.unassign, { body: { loop: loopId, runner: runnerId } });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Runner removal failed with status ${response.status}`));
  }
};

export const fetchLoopRunnerSessions = async (loopId: string): Promise<LoopRunnerSessionsResult> => {
  const response = await authenticatedJsonGet(runnerApiPaths.loopSessions(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop runner sessions request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopRunnerSessionsResult>;
};

export const fetchLoopRunnerRepositoryList = async (loopId: string, runnerId: string): Promise<LoopRunnerRepository[]> => {
  const response = await authenticatedJsonGet(runnerApiPaths.loopRunnerRepositories(loopId, runnerId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop runner repositories request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopRunnerRepository[]>;
};

export const updateLoopRunnerRepositoryList = async (loopId: string, runnerId: string, repositoryIds: string[]): Promise<void> => {
  const response = await authenticatedJsonPut(runnerApiPaths.loopRunnerRepositories(loopId, runnerId), { repositoryIds });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop runner repositories update failed with status ${response.status}`));
  }
};
