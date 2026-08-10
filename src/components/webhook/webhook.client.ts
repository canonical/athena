import { authenticatedJsonDelete, authenticatedJsonGet, authenticatedJsonPost, authenticatedJsonPut } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { LoopWorkgraphWebhook, LoopWorkgraphWebhookCreate, LoopWorkgraphWebhookCreateResult, LoopWorkgraphWebhookUpdate } from "./webhook.schema.js";

export const webhookApiPaths = {
  loopWorkgraphList: (loopId: string, workgraphId: string) => getApiUrl(`/webhook/loop/${loopId}/workgraph/${workgraphId}`),
  loopWorkgraphById: (loopId: string, workgraphId: string, webhookId: string) => getApiUrl(`/webhook/loop/${loopId}/workgraph/${workgraphId}/${webhookId}`),
  inboundWebhookByReceiver: (receiverId: string) => getApiUrl(`/webhook/inbound/${receiverId}`),
} as const;

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const fetchLoopWorkgraphWebhooks = async (loopId: string, workgraphId: string): Promise<LoopWorkgraphWebhook[]> => {
  const response = await authenticatedJsonGet(webhookApiPaths.loopWorkgraphList(loopId, workgraphId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop workgraph webhook request failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopWorkgraphWebhook[]>;
};

export const createLoopWorkgraphWebhook = async (loopId: string, workgraphId: string, payload: LoopWorkgraphWebhookCreate): Promise<LoopWorkgraphWebhookCreateResult> => {
  const response = await authenticatedJsonPost(webhookApiPaths.loopWorkgraphList(loopId, workgraphId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop workgraph webhook creation failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopWorkgraphWebhookCreateResult>;
};

export const updateLoopWorkgraphWebhook = async (loopId: string, workgraphId: string, webhookId: string, payload: LoopWorkgraphWebhookUpdate): Promise<LoopWorkgraphWebhook> => {
  const response = await authenticatedJsonPut(webhookApiPaths.loopWorkgraphById(loopId, workgraphId, webhookId), payload);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop workgraph webhook update failed with status ${response.status}`));
  }

  return response.json() as Promise<LoopWorkgraphWebhook>;
};

export const deleteLoopWorkgraphWebhook = async (loopId: string, workgraphId: string, webhookId: string): Promise<void> => {
  const response = await authenticatedJsonDelete(webhookApiPaths.loopWorkgraphById(loopId, workgraphId, webhookId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Loop workgraph webhook deletion failed with status ${response.status}`));
  }
};
