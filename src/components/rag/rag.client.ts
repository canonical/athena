import { authenticatedJsonDelete, authenticatedJsonGet, authenticatedJsonPost, authenticatedJsonPut } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { RagIndex, RagIndexConfigure, RagIndexState } from "./rag.schema.js";

const loopRagPath = (loopId: string) => getApiUrl(`/rag/loop/${loopId}`);
const ragIndexPath = (indexId: string) => getApiUrl(`/rag/${indexId}`);

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? fallback;
};

export const fetchRagIndexState = async (loopId: string): Promise<RagIndexState> => {
  const response = await authenticatedJsonGet(loopRagPath(loopId));
  if (!response.ok) throw new Error(await readErrorMessage(response, `Memory state request failed.`));
  return response.json() as Promise<RagIndexState>;
};

export const configureRagIndex = async (loopId: string, input: RagIndexConfigure): Promise<RagIndex> => {
  const response = await authenticatedJsonPut(loopRagPath(loopId), input);
  if (!response.ok) throw new Error(await readErrorMessage(response, `Memory configuration failed.`));
  return response.json() as Promise<RagIndex>;
};

export const removeRagIndex = async (indexId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(ragIndexPath(indexId));
  if (!response.ok) throw new Error(await readErrorMessage(response, `Unable to remove memory.`));
};

export const repairRagIndex = async (indexId: string): Promise<RagIndex> => {
  const response = await authenticatedJsonPost(`${ragIndexPath(indexId)}/repair`, {});
  if (!response.ok) throw new Error(await readErrorMessage(response, `Unable to scan and repair memory.`));
  return response.json() as Promise<RagIndex>;
};
