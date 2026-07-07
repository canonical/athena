import { authenticatedFetch } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { Loop, LoopInsert, LoopUpdate, ProviderSelectionPolicy, ProviderSelectionPolicyUpdate } from "./loop.schema.js";

export const loopApiPaths = {
  list: getApiUrl(`/loop-list`),
  byId: (loopId: string) => getApiUrl(`/loop/${loopId}`),
  providerSelectionPolicy: (loopId: string) => getApiUrl(`/loop/${loopId}/provider-selection-policy`),
} as const;

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const fetchLoopList = async (): Promise<Loop[]> => {
  const response = await authenticatedFetch(loopApiPaths.list);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loops request failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop[]>;
};

export const fetchLoop = async (loopId: string): Promise<Loop> => {
  const response = await authenticatedFetch(loopApiPaths.byId(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop request failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop>;
};

export const createLoop = async (payload: LoopInsert): Promise<Loop> => {
  const response = await authenticatedFetch(loopApiPaths.list, {
    method: `POST`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop>;
};

export const updateLoop = async (loopId: string, payload: LoopUpdate): Promise<Loop> => {
  const response = await authenticatedFetch(loopApiPaths.byId(loopId), {
    method: `PUT`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop update failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop>;
};

export const deleteLoop = async (loopId: string): Promise<void> => {
  const response = await authenticatedFetch(loopApiPaths.byId(loopId), {
    method: `DELETE`,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop deletion failed with status ${response.status}`));
  }
};

export const fetchProviderSelectionPolicy = async (loopId: string): Promise<ProviderSelectionPolicy> => {
  const response = await authenticatedFetch(loopApiPaths.providerSelectionPolicy(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider selection policy request failed with status ${response.status}`));
  }

  return response.json() as Promise<ProviderSelectionPolicy>;
};

export const updateProviderSelectionPolicy = async (loopId: string, payload: ProviderSelectionPolicyUpdate): Promise<ProviderSelectionPolicy> => {
  const response = await authenticatedFetch(loopApiPaths.providerSelectionPolicy(loopId), {
    method: `PUT`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider selection policy update failed with status ${response.status}`));
  }

  return response.json() as Promise<ProviderSelectionPolicy>;
};
