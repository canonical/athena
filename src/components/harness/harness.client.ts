import { authenticatedFetch } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { Harness, HarnessInsert, HarnessUpdate, LoopHarness } from "./harness.schema.js";

export const harnessApiPaths = {
  list: getApiUrl(`/harness-list`),
  byId: (harnessId: string) => getApiUrl(`/harness/${harnessId}`),
  loopList: (loopId: string) => getApiUrl(`/loop/${loopId}/harness-list`),
  loopAssignmentAdmin: (loopId: string, harnessId: string) => getApiUrl(`/loop/${loopId}/harness/${harnessId}/admin`),
} as const;

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const fetchHarnessList = async (): Promise<Harness[]> => {
  const response = await authenticatedFetch(harnessApiPaths.list);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Harnesses request failed with status ${response.status}`));
  }

  return response.json() as Promise<Harness[]>;
};

export const fetchHarnessById = async (id: string): Promise<Harness> => {
  const response = await authenticatedFetch(harnessApiPaths.byId(id));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Harness request failed with status ${response.status}`));
  }

  return response.json() as Promise<Harness>;
};

export const createHarness = async (payload: HarnessInsert): Promise<Harness> => {
  const response = await authenticatedFetch(harnessApiPaths.list, {
    method: `POST`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Harness creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Harness>;
};

export const updateHarness = async (harnessId: string, payload: HarnessUpdate): Promise<Harness> => {
  const response = await authenticatedFetch(harnessApiPaths.byId(harnessId), {
    method: `PUT`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Harness update failed with status ${response.status}`));
  }

  return response.json() as Promise<Harness>;
};

export const deleteHarness = async (harnessId: string): Promise<void> => {
  const response = await authenticatedFetch(harnessApiPaths.byId(harnessId), {
    method: `DELETE`,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Harness deletion failed with status ${response.status}`));
  }
};

export const fetchLoopHarnessList = async (loopId: string): Promise<LoopHarness[]> => {
  const response = await authenticatedFetch(harnessApiPaths.loopList(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop harnesses request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopHarness[]>;
};

export const assignHarnessToLoop = async (loopId: string, harnessId: string): Promise<void> => {
  const response = await authenticatedFetch(harnessApiPaths.loopList(loopId), {
    method: `POST`,
    headers: { "Content-Type": `application/json` },
    body: JSON.stringify({ harness: harnessId }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Harness assignment failed with status ${response.status}`));
  }
};

export const removeHarnessFromLoop = async (loopId: string, harnessId: string): Promise<void> => {
  const response = await authenticatedFetch(harnessApiPaths.loopAssignmentAdmin(loopId, harnessId), {
    method: `DELETE`,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Harness removal failed with status ${response.status}`));
  }
};
