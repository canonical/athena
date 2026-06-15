import { getApiUrl } from "@components/config/frontend.client.js";
import type { Loop } from "./loop.schema.js";

export type LoopPayload = {
  name: string;
  description?: string;
};

export const loopApiPaths = {
  list: getApiUrl(`/loops`),
  byId: (loopId: string) => getApiUrl(`/loops/${loopId}`),
} as const;

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const fetchLoops = async (): Promise<Loop[]> => {
  const response = await fetch(loopApiPaths.list, { credentials: `include` });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loops request failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop[]>;
};

export const fetchLoop = async (loopId: string): Promise<Loop> => {
  const response = await fetch(loopApiPaths.byId(loopId), { credentials: `include` });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop request failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop>;
};

export const createLoop = async (payload: LoopPayload): Promise<Loop> => {
  const response = await fetch(loopApiPaths.list, {
    method: `POST`,
    headers: { "Content-Type": `application/json` },
    credentials: `include`,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop>;
};

export const updateLoop = async (loopId: string, payload: LoopPayload): Promise<Loop> => {
  const response = await fetch(loopApiPaths.byId(loopId), {
    method: `PUT`,
    headers: { "Content-Type": `application/json` },
    credentials: `include`,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop update failed with status ${response.status}`));
  }

  return response.json() as Promise<Loop>;
};

export const deleteLoop = async (loopId: string): Promise<void> => {
  const response = await fetch(loopApiPaths.byId(loopId), {
    method: `DELETE`,
    credentials: `include`,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop deletion failed with status ${response.status}`));
  }
};
