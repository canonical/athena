import { authenticatedJsonGet, authenticatedJsonPut } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { LoopMemoryConfig, LoopMemoryConfigUpdate } from "./loop-memory.schema.js";

const configPath = (loopId: string) => getApiUrl(`/loop/${loopId}/history-memory`);

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const fetchLoopMemoryConfig = async (loopId: string): Promise<LoopMemoryConfig> => {
  const response = await authenticatedJsonGet(configPath(loopId));
  if (!response.ok) throw new Error(await readErrorMessage(response, `Loop history memory request failed with status ${response.status}`));
  return response.json() as Promise<LoopMemoryConfig>;
};

export const updateLoopMemoryConfig = async (loopId: string, input: LoopMemoryConfigUpdate): Promise<LoopMemoryConfig> => {
  const response = await authenticatedJsonPut(configPath(loopId), input);
  if (!response.ok) throw new Error(await readErrorMessage(response, `Loop history memory update failed with status ${response.status}`));
  return response.json() as Promise<LoopMemoryConfig>;
};
