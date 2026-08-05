import { authenticatedJsonDelete, authenticatedJsonGet, authenticatedJsonPost, authenticatedJsonPut } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { Loop, LoopInsert, LoopLlmTools, LoopLlmToolsUpdateRequest, LoopReadiness, LoopUpdate, ProviderSelectionPolicy, ProviderSelectionPolicyUpdate } from "./loop.schema.js";

export const loopApiPaths = {
  list: getApiUrl(`/loop`),
  byId: (loopId: string) => getApiUrl(`/loop/${loopId}`),
  llmTools: (loopId: string) => getApiUrl(`/loop/${loopId}/llm-tools`),
  providerSelectionPolicy: (loopId: string) => getApiUrl(`/loop/${loopId}/provider-selection-policy`),
  readiness: (loopId: string) => getApiUrl(`/loop/${loopId}/readiness`),
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
  const response = await authenticatedJsonGet(loopApiPaths.list);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loops request failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop[]>;
};

export const fetchLoop = async (loopId: string): Promise<Loop> => {
  const response = await authenticatedJsonGet(loopApiPaths.byId(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop request failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop>;
};

export const createLoop = async (payload: LoopInsert): Promise<Loop> => {
  const response = await authenticatedJsonPost(loopApiPaths.list, payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop>;
};

export const updateLoop = async (loopId: string, payload: LoopUpdate): Promise<Loop> => {
  const response = await authenticatedJsonPut(loopApiPaths.byId(loopId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop update failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop>;
};

export const deleteLoop = async (loopId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(loopApiPaths.byId(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop deletion failed with status ${response.status}`));
  }
};

export const fetchProviderSelectionPolicy = async (loopId: string): Promise<ProviderSelectionPolicy> => {
  const response = await authenticatedJsonGet(loopApiPaths.providerSelectionPolicy(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider selection policy request failed with status ${response.status}`));
  }

  return response.json() as Promise<ProviderSelectionPolicy>;
};

export const updateProviderSelectionPolicy = async (loopId: string, payload: ProviderSelectionPolicyUpdate): Promise<ProviderSelectionPolicy> => {
  const response = await authenticatedJsonPut(loopApiPaths.providerSelectionPolicy(loopId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider selection policy update failed with status ${response.status}`));
  }

  return response.json() as Promise<ProviderSelectionPolicy>;
};

export const fetchLoopReadiness = async (loopId: string): Promise<LoopReadiness> => {
  const response = await authenticatedJsonGet(loopApiPaths.readiness(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop readiness request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopReadiness>;
};

export const fetchLoopLlmTools = async (loopId: string): Promise<LoopLlmTools> => {
  const response = await authenticatedJsonGet(loopApiPaths.llmTools(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop LLM tools request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopLlmTools>;
};

export const updateLoopLlmTools = async (loopId: string, payload: LoopLlmToolsUpdateRequest): Promise<LoopLlmTools> => {
  const response = await authenticatedJsonPut(loopApiPaths.llmTools(loopId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop LLM tools update failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopLlmTools>;
};
