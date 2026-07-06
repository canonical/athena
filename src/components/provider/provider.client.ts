import { authenticatedFetch } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { LoopProvider, Provider, ProviderInsert, ProviderUpdate } from "./provider.schema.js";

export const providerApiPaths = {
  list: getApiUrl(`/provider-list`),
  byId: (providerId: string) => getApiUrl(`/provider/${providerId}`),
  loopList: (loopId: string) => getApiUrl(`/loop/${loopId}/provider-list`),
  loopAssignmentAdmin: (loopId: string, providerId: string) => getApiUrl(`/loop/${loopId}/provider/${providerId}/admin`),
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
  const response = await authenticatedFetch(providerApiPaths.list);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Providers request failed with status ${response.status}`));
  }

  return response.json() as Promise<Provider[]>;
};

export const fetchProviderById = async (id: string): Promise<Provider> => {
  const response = await authenticatedFetch(providerApiPaths.byId(id));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider request failed with status ${response.status}`));
  }

  return response.json() as Promise<Provider>;
};

export const createProvider = async (payload: ProviderInsert): Promise<Provider> => {
  const response = await authenticatedFetch(providerApiPaths.list, {
    method: `POST`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Provider>;
};

export const updateProvider = async (providerId: string, payload: ProviderUpdate): Promise<Provider> => {
  const response = await authenticatedFetch(providerApiPaths.byId(providerId), {
    method: `PUT`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider update failed with status ${response.status}`));
  }

  return response.json() as Promise<Provider>;
};

export const deleteProvider = async (providerId: string): Promise<void> => {
  const response = await authenticatedFetch(providerApiPaths.byId(providerId), {
    method: `DELETE`,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider deletion failed with status ${response.status}`));
  }
};

export const fetchLoopProviderList = async (loopId: string): Promise<LoopProvider[]> => {
  const response = await authenticatedFetch(providerApiPaths.loopList(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop providers request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopProvider[]>;
};

export const assignProviderToLoop = async (loopId: string, providerId: string): Promise<void> => {
  const response = await authenticatedFetch(providerApiPaths.loopList(loopId), {
    method: `POST`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify({ provider: providerId }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider assignment failed with status ${response.status}`));
  }
};

export const removeProviderFromLoop = async (loopId: string, providerId: string): Promise<void> => {
  const response = await authenticatedFetch(providerApiPaths.loopAssignmentAdmin(loopId, providerId), {
    method: `DELETE`,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Provider removal failed with status ${response.status}`));
  }
};
