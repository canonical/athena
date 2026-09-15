import { RagExecutionError } from "./rag.errors.js";
import { fetchProviderEmbeddings } from "./rag.provider-embedding.service.js";
import type { RagLookupHit, RagRetrievalRequest } from "./rag.schema.js";
import { ragEntryLookup } from "./rag.storage.service.js";

export const ragRetrieve = async (request: RagRetrievalRequest): Promise<RagLookupHit[]> => {
  const embeddings = await fetchProviderEmbeddings({
    connection: request.connection,
    model: request.model,
    texts: [request.query],
    operation: request.operation,
    idempotencyKey: request.idempotencyKey,
  });
  const embedding = embeddings[0];

  if (!embedding) {
    throw new RagExecutionError(`RAG query embedding was not returned.`);
  }

  return ragEntryLookup({
    executor: request.executor,
    ragIndex: request.ragIndex,
    embedding,
    limit: request.limit,
  });
};
