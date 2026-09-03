import { fetchOpenRouterEmbeddings } from "@components/openrouter/openrouter.service.js";
import type { RagEmbeddingRequest } from "./rag.schema.js";

export const fetchProviderEmbeddings = async (request: RagEmbeddingRequest): Promise<number[][]> => {
  if (request.texts.length === 0) {
    return [];
  }

  return fetchOpenRouterEmbeddings(request.connection, {
    model: request.model,
    input: request.texts,
    operation: request.operation,
    idempotencyKey: request.idempotencyKey,
  });
};
