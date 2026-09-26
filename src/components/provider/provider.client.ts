import { authenticatedJsonDelete, authenticatedJsonGet, authenticatedJsonPost, authenticatedJsonPut } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { LoopProvider, Provider, ProviderCapability, ProviderInsert, ProviderModel, ProviderModelPreviewRequest, ProviderModelValidateResponse, ProviderUpdate } from "./provider.schema.js";

export const providerApiPaths = {
  list: getApiUrl(`/provider`),
  byId: (providerId: string) => getApiUrl(`/provider/${providerId}`),
  modelsById: (providerId: string) => getApiUrl(`/provider/${providerId}/models`),
  validateModelsById: (providerId: string) => getApiUrl(`/provider/${providerId}/models/validate`),
  modelsPreview: getApiUrl(`/provider/models/preview`),
  loopList: (loopId: string) => getApiUrl(`/provider/loop/${loopId}/list`),
  assign: getApiUrl(`/provider/assign`),
  unassign: getApiUrl(`/provider/unassign`),
} as const;

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const fetchProviderList = async (): Promise<Provider[]> => {
  const response = await authenticatedJsonGet(providerApiPaths.list);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Providers request failed with status ${response.status}`));
  }

  return response.json() as Promise<Provider[]>;
};

export const fetchProviderById = async (id: string): Promise<Provider> => {
  const response = await authenticatedJsonGet(providerApiPaths.byId(id));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider request failed with status ${response.status}`));
  }

  return response.json() as Promise<Provider>;
};

export const createProvider = async (payload: ProviderInsert): Promise<Provider> => {
  const response = await authenticatedJsonPost(providerApiPaths.list, payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Provider>;
};

export const updateProvider = async (providerId: string, payload: ProviderUpdate): Promise<Provider> => {
  const response = await authenticatedJsonPut(providerApiPaths.byId(providerId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider update failed with status ${response.status}`));
  }

  return response.json() as Promise<Provider>;
};

export const fetchProviderModels = async (providerId: string): Promise<ProviderModel[]> => {
  const response = await authenticatedJsonGet(providerApiPaths.modelsById(providerId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider models request failed with status ${response.status}`));
  }

  const payload = (await response.json()) as { models?: ProviderModel[] };
  return Array.isArray(payload.models) ? payload.models : [];
};

export const validateProviderModels = async (providerId: string, capability: ProviderCapability, models: string[]): Promise<ProviderModelValidateResponse> => {
  const response = await authenticatedJsonPost(providerApiPaths.validateModelsById(providerId), { capability, models });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider model validation failed with status ${response.status}`));
  }

  return response.json() as Promise<ProviderModelValidateResponse>;
};

export const previewProviderModels = async (payload: ProviderModelPreviewRequest): Promise<ProviderModel[]> => {
  const response = await authenticatedJsonPost(providerApiPaths.modelsPreview, payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider model preview failed with status ${response.status}`));
  }

  const body = (await response.json()) as { models?: ProviderModel[] };
  return Array.isArray(body.models) ? body.models : [];
};

export const deleteProvider = async (providerId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(providerApiPaths.list, { body: { provider: providerId } });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider deletion failed with status ${response.status}`));
  }
};

export const fetchLoopProviderList = async (loopId: string): Promise<LoopProvider[]> => {
  const response = await authenticatedJsonGet(providerApiPaths.loopList(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop providers request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopProvider[]>;
};

export const assignProviderToLoop = async (loopId: string, providerId: string): Promise<void> => {
  const response = await authenticatedJsonPost(providerApiPaths.assign, { loop: loopId, provider: providerId });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider assignment failed with status ${response.status}`));
  }
};

export const removeProviderFromLoop = async (loopId: string, providerId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(providerApiPaths.unassign, { body: { loop: loopId, provider: providerId } });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider removal failed with status ${response.status}`));
  }
};
