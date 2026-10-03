import { queryLoopDisabledProviderToolsById } from "@components/loop/loop.service.js";
import { resolveLoopSelectionByAssignment } from "@components/loop/loop-selection.service.js";
import { query } from "@components/postgres/postgres.js";
import { RagExecutionError } from "@components/rag/rag.errors.js";
import { ragRetrieve } from "@components/rag/rag.retrieval.service.js";
import { queryRagIndexByAlias } from "@components/rag/rag.service.js";
import type { ProviderToolExecutionContext } from "./tool.schema.js";

const resolveRagLookupTargetForInput = async (loopId: string, input: Record<string, unknown> | undefined) => {
  const indexAlias = typeof input?.index === `string` ? input.index.trim() : ``;
  const disabledTools = await queryLoopDisabledProviderToolsById(loopId);

  if (disabledTools.includes(`rag_lookup`)) {
    throw new RagExecutionError(`rag_lookup is disabled for this loop.`);
  }

  const index = await queryRagIndexByAlias(loopId, indexAlias);

  if (!index) {
    throw new RagExecutionError(`RAG index alias ${indexAlias || `(empty)`} is not available in this loop.`);
  }

  if (index.lifecycleStatus !== `ready`) {
    throw new RagExecutionError(`RAG index ${indexAlias} is ${index.lifecycleStatus}; lookup requires a ready index.`);
  }

  if (!index.embeddingDimension) {
    throw new RagExecutionError(`RAG index ${indexAlias} has no established embedding dimension.`);
  }

  const provider = await resolveLoopSelectionByAssignment(loopId, `provider`, index.provider, { capability: `embedding` });

  if (!provider.selected?.baseUrl) {
    throw new RagExecutionError(`RAG index ${indexAlias} has no embedding provider available in this loop.`);
  }

  if (!provider.selected.enabledModels.includes(index.embeddingModel)) {
    throw new RagExecutionError(`Embedding model ${index.embeddingModel} is not enabled on the provider for index ${indexAlias}.`);
  }

  return {
    indexAlias,
    index,
    connection: {
      baseUrl: provider.selected.baseUrl,
      apiKey: provider.selected.secret,
    },
  };
};

export const executeRagLookup = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const searchQuery = typeof input?.query === `string` ? input.query.trim() : ``;
  const limit = typeof input?.limit === `number` ? input.limit : 5;
  const { indexAlias, index, connection } = await resolveRagLookupTargetForInput(context.loopId, input);

  const hits = await ragRetrieve({
    executor: { query },
    ragIndex: index.ragIndex,
    connection,
    model: index.embeddingModel,
    query: searchQuery,
    limit,
    operation: `rag-lookup`,
  });

  return {
    index: indexAlias,
    query: searchQuery,
    count: hits.length,
    matches: hits.map((hit) => ({
      text: hit.text,
      similarity: hit.similarity,
      source: {
        kind: hit.sourceKind,
        type: hit.sourceType,
        id: hit.sourceId,
        logicalRef: hit.logicalRef,
        occurredAt: hit.occurredAt,
        provenance: hit.provenance,
      },
    })),
  };
};
