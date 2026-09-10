import { queryLoopAdminMembership, queryLoopForUser } from "@components/loop/loop.service.js";
import { RagForbiddenError, RagNotFoundError, RagValidationError } from "./rag.errors.js";
import { enqueueRagIndexBuild } from "./rag.job.js";
import type { RagIndex, RagIndexConfigure, RagIndexState } from "./rag.schema.js";
import { queryRagEmbeddingProviderOptions, queryRagIndexByLoop } from "./rag.service.js";
import { queryRagIndexConfigure, queryRagIndexRemove, queryRagIndexRepairStart } from "./rag.transaction.service.js";

export const ragIndexStateGet = async (loopId: string, userId: string): Promise<RagIndexState> => {
  if (!(await queryLoopForUser(loopId, userId))) {
    throw new RagNotFoundError(`Loop not found.`);
  }

  const [index, embeddingProviders, currentUserIsAdmin] = await Promise.all([queryRagIndexByLoop(loopId), queryRagEmbeddingProviderOptions(loopId), queryLoopAdminMembership(loopId, userId)]);
  return { index: index ?? null, embeddingProviders, currentUserIsAdmin };
};

export const ragIndexConfigure = async (loopId: string, userId: string, input: RagIndexConfigure): Promise<RagIndex> => {
  if (!(await queryLoopAdminMembership(loopId, userId))) {
    if (!(await queryLoopForUser(loopId, userId))) {
      throw new RagNotFoundError(`Loop not found.`);
    }

    throw new RagForbiddenError(`Only loop admins may configure memory.`);
  }

  const providers = await queryRagEmbeddingProviderOptions(loopId);
  const provider = providers.find((option) => option.provider === input.provider);

  if (!provider?.models.includes(input.embeddingModel)) {
    throw new RagValidationError(`The selected embedding provider and model must be enabled and assigned to this loop.`);
  }

  const result = await queryRagIndexConfigure(loopId, userId, input);

  if (result.status === `notFound`) {
    throw new RagNotFoundError(`Loop not found.`);
  }

  if (result.status === `forbidden`) {
    throw new RagForbiddenError(`Only loop admins may configure memory.`);
  }

  if (result.status === `active`) {
    throw new RagValidationError(`Remove memory before enabling it with a different provider or model.`);
  }

  if (result.status === `providerUnavailable`) {
    throw new RagValidationError(`The selected embedding provider and model are no longer available to this loop.`);
  }

  if (result.buildRequired) await enqueueRagIndexBuild(result.index.id);
  return result.index;
};

export const ragIndexRemove = async (indexId: string, userId: string): Promise<void> => {
  if (!(await queryRagIndexRemove(indexId, userId))) throw new RagNotFoundError(`RAG index not found.`);
};

export const ragIndexRepair = async (indexId: string, userId: string): Promise<RagIndex> => {
  const index = await queryRagIndexRepairStart(indexId, userId);
  if (!index) throw new RagNotFoundError(`RAG index not found.`);
  await enqueueRagIndexBuild(index.id);
  return index;
};
