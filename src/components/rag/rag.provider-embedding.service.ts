import { resolveLoopSelectionByAssignment } from "@components/loop/loop-selection.service.js";
import { fetchOpenRouterEmbeddings } from "@components/openrouter/openrouter.service.js";
import { query } from "@components/postgres/postgres.js";
import { RagExecutionError } from "./rag.errors.js";
import type { RagEmbeddingRequest, RagIndexEmbeddingTarget } from "./rag.schema.js";

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

export const fetchRagIndexEmbeddings = async (ragIndexId: string, request: Omit<RagEmbeddingRequest, `connection` | `model`>): Promise<number[][]> => {
  const targetResult = await query<RagIndexEmbeddingTarget>(`SELECT "sourceRef" AS "loop", "provider", "embeddingModel" FROM "ragIndex" WHERE "id" = $1 AND "kind" = 'loopActivity' AND "lifecycleStatus" IN ('rebuilding', 'ready')`, [
    ragIndexId,
  ]);
  const target = targetResult.rows[0];
  if (!target) throw new RagExecutionError(`RAG index is unavailable for embedding.`);
  const resolution = await resolveLoopSelectionByAssignment(target.loop, `provider`, target.provider, { capability: `embedding` });
  if (!resolution.selected?.baseUrl || !resolution.selected.enabledModels.includes(target.embeddingModel)) throw new RagExecutionError(`RAG embedding provider is unavailable.`);
  return fetchProviderEmbeddings({ ...request, connection: { baseUrl: resolution.selected.baseUrl, apiKey: resolution.selected.secret }, model: target.embeddingModel });
};
