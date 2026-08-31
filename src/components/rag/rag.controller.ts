import { queryLoopAdminMembership, queryLoopForUser } from "@components/loop/loop.service.js";
import { RagForbiddenError, RagNotFoundError, RagValidationError } from "./rag.errors.js";
import type { RagIndex, RagIndexConfigure, RagIndexState } from "./rag.schema.js";
import { queryRagEmbeddingProviderOptions, queryRagIndexByLoop } from "./rag.service.js";
import { queryRagIndexConfigure } from "./rag.transaction.service.js";

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
    throw new RagValidationError(`Memory configuration can only be replaced while the index is disabled.`);
  }

  if (result.status === `providerUnavailable`) {
    throw new RagValidationError(`The selected embedding provider and model are no longer available to this loop.`);
  }

  return result.index;
};
