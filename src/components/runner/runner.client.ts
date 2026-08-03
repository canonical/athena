import { authenticatedJsonDelete, authenticatedJsonGet, authenticatedJsonPost, authenticatedJsonPut } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { LoopRunner, Runner, RunnerInsert, RunnerUpdate } from "./runner.schema.js";

export const runnerApiPaths = {
  list: getApiUrl(`/runner`),
  byId: (runnerId: string) => getApiUrl(`/runner/${runnerId}`),
  loopList: (loopId: string) => getApiUrl(`/runner/loop/${loopId}/list`),
  assign: getApiUrl(`/runner/assign`),
  unassign: getApiUrl(`/runner/unassign`),
} as const;

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
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

export const assignRunnerToLoop = async (loopId: string, runnerId: string): Promise<void> => {
  const response = await authenticatedJsonPost(runnerApiPaths.assign, { loop: loopId, runner: runnerId });

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
