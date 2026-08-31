import { authenticatedJsonGet, authenticatedJsonPut } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { RagIndex, RagIndexConfigure, RagIndexState } from "./rag.schema.js";

const ragStatePath = (loopId: string) => getApiUrl(`/rag/loop/${loopId}`);

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? fallback;
};

export const fetchRagIndexState = async (loopId: string): Promise<RagIndexState> => {
  const response = await authenticatedJsonGet(ragStatePath(loopId));
  if (!response.ok) throw new Error(await readErrorMessage(response, `Memory state request failed.`));
  return response.json() as Promise<RagIndexState>;
};

export const configureRagIndex = async (loopId: string, input: RagIndexConfigure): Promise<RagIndex> => {
  const response = await authenticatedJsonPut(ragStatePath(loopId), input);
  if (!response.ok) throw new Error(await readErrorMessage(response, `Memory configuration failed.`));
  return response.json() as Promise<RagIndex>;
};
