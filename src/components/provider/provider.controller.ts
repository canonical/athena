import type { AppLogger } from "@components/logging/logging.schema.js";
import { queryLoopAdminMembership, queryLoopForUser, queryLoopMembership } from "@components/loop/loop.service.js";
import { fetchOpenRouterModels, validateOpenRouterEmbeddingModel, validateOpenRouterModel } from "@components/openrouter/openrouter.service.js";
import { queryLoopProviderDelete, queryProviderDelete } from "@components/rag/rag.transaction.service.js";
import { isValidUuid } from "@components/utilities/zod.utilities.js";
import { ProviderForbiddenError, ProviderNotFoundError, ProviderValidationError } from "./provider.errors.js";
import type {
  LoopProvider,
  LoopProviderAdminUpdate,
  LoopProviderInsert,
  Provider,
  ProviderCapability,
  ProviderInsert,
  ProviderModel,
  ProviderModelPreviewRequest,
  ProviderModelValidateResultItem,
  ProviderUpdate,
} from "./provider.schema.js";
import {
  queryLoopProviderAssign,
  queryLoopProviderList,
  queryLoopProviderUpdateByAdmin,
  queryProviderApiConnectionByOwner,
  queryProviderByIdForOwner,
  queryProviderCreate,
  queryProviderListByOwner,
  queryProviderUpdate,
} from "./provider.service.js";

const validateLoopId = (loopId: string): void => {
  if (!isValidUuid(loopId)) {
    throw new ProviderValidationError(`loopId must be a valid UUID.`);
  }
};

const validateProviderId = (providerId: string): void => {
  if (!isValidUuid(providerId)) {
    throw new ProviderValidationError(`providerId must be a valid UUID.`);
  }
};

const enforceOpenRouterOnly = (providerType: string): void => {
  if (providerType !== `openrouter`) {
    throw new ProviderValidationError(`Only openrouter providerType is supported in this phase.`);
  }
};

const fetchProviderModelsByType = async (providerType: string, connection: { baseUrl: string; apiKey: string }, logger?: AppLogger): Promise<ProviderModel[]> => {
  switch (providerType) {
    case `openrouter`:
      return fetchOpenRouterModels(connection, logger);
    default:
      throw new ProviderValidationError(`Unsupported providerType for model listing: ${providerType}.`);
  }
};

type ProviderModelConfig = {
  chatDefaultModel: string | null;
  chatEnabledModels: string[] | null;
  embeddingDefaultModel: string | null;
  embeddingEnabledModels: string[] | null;
};

const normalizeCapabilityModelConfig = (capability: `Chat` | `Embedding`, defaultModel: string | null, enabledModels: string[] | null): { defaultModel: string | null; enabledModels: string[] | null } => {
  const normalizedEnabledModels = enabledModels === null ? null : Array.from(new Set(enabledModels.map((value) => value.trim()).filter((value) => value.length > 0)));
  const normalizedDefaultModel = defaultModel?.trim() ?? null;

  if (normalizedDefaultModel && !normalizedEnabledModels?.includes(normalizedDefaultModel)) {
    throw new ProviderValidationError(`${capability} default model must also be present in enabled models.`);
  }

  return { defaultModel: normalizedDefaultModel, enabledModels: normalizedEnabledModels };
};

const normalizeProviderModelConfig = <T extends ProviderModelConfig>(input: T): T => {
  const chat = normalizeCapabilityModelConfig(`Chat`, input.chatDefaultModel, input.chatEnabledModels);
  const embedding = normalizeCapabilityModelConfig(`Embedding`, input.embeddingDefaultModel, input.embeddingEnabledModels);

  return {
    ...input,
    chatDefaultModel: chat.defaultModel,
    chatEnabledModels: chat.enabledModels,
    embeddingDefaultModel: embedding.defaultModel,
    embeddingEnabledModels: embedding.enabledModels,
  };
};

export const providerList = async (ownerId: string): Promise<Provider[]> => queryProviderListByOwner(ownerId);

export const providerGet = async (providerId: string, ownerId: string): Promise<Provider> => {
  validateProviderId(providerId);

  const provider = await queryProviderByIdForOwner(providerId, ownerId);

  if (!provider) {
    throw new ProviderNotFoundError(`Provider not found.`);
  }

  return provider;
};

export const providerCreate = async (input: ProviderInsert, ownerId: string): Promise<Provider> => {
  enforceOpenRouterOnly(input.providerType);

  return queryProviderCreate(normalizeProviderModelConfig(input), ownerId);
};

export const providerUpdate = async (providerId: string, ownerId: string, input: ProviderUpdate): Promise<Provider> => {
  validateProviderId(providerId);
  enforceOpenRouterOnly(input.providerType);

  const updated = await queryProviderUpdate(providerId, ownerId, normalizeProviderModelConfig(input));

  if (!updated) {
    throw new ProviderNotFoundError(`Provider not found.`);
  }

  return updated;
};

export const providerDelete = async (providerId: string, ownerId: string): Promise<void> => {
  validateProviderId(providerId);

  const result = await queryProviderDelete(providerId, ownerId);

  if (result.status === `notFound`) {
    throw new ProviderNotFoundError(`Provider not found.`);
  }

  if (result.status === `inUse`) {
    const loopIds = Array.from(new Set(result.ragIndexes.map((index) => index.loop).filter((loop): loop is string => loop !== null)));
    throw new ProviderValidationError(`Provider cannot be deleted because it is used by loops: ${loopIds.join(`, `)}.`, {
      usingEntities: loopIds.map((loop) => ({ type: `loop`, id: loop })),
    });
  }
};

export const providerModels = async (providerId: string, ownerId: string, logger?: AppLogger): Promise<ProviderModel[]> => {
  validateProviderId(providerId);

  const connection = await queryProviderApiConnectionByOwner(providerId, ownerId);

  if (!connection) {
    throw new ProviderNotFoundError(`Provider not found.`);
  }

  return fetchProviderModelsByType(connection.providerType, connection, logger);
};

export const providerModelPreview = async (input: ProviderModelPreviewRequest, logger?: AppLogger): Promise<ProviderModel[]> => {
  return fetchProviderModelsByType(
    input.providerType,
    {
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
    },
    logger,
  );
};

export const providerValidateModels = async (providerId: string, ownerId: string, capability: ProviderCapability, models: string[], logger?: AppLogger): Promise<ProviderModelValidateResultItem[]> => {
  validateProviderId(providerId);

  const connection = await queryProviderApiConnectionByOwner(providerId, ownerId);

  if (!connection) {
    throw new ProviderNotFoundError(`Provider not found.`);
  }

  if (connection.providerType !== `openrouter`) {
    throw new ProviderValidationError(`Model validation is only supported for openrouter providers.`);
  }

  const uniqueModels = Array.from(new Set(models.map((value) => value.trim()).filter((value) => value.length > 0)));

  if (uniqueModels.length === 0) {
    return [];
  }

  const results: ProviderModelValidateResultItem[] = [];
  const validationConcurrency = 8;

  for (let index = 0; index < uniqueModels.length; index += validationConcurrency) {
    const batchModels = uniqueModels.slice(index, index + validationConcurrency);
    const batchValidations = await Promise.all(
      batchModels.map(async (model) => ({
        model,
        validation: await (capability === `embedding` ? validateOpenRouterEmbeddingModel : validateOpenRouterModel)(
          {
            baseUrl: connection.baseUrl,
            apiKey: connection.apiKey,
          },
          {
            model,
            operation: `provider-${capability}-model-validate`,
            timeoutMs: 20_000,
            logger,
            context: {
              providerId,
              capability,
              model,
            },
          },
        ),
      })),
    );

    for (const { model, validation } of batchValidations) {
      if (validation.available) {
        results.push({
          model,
          available: true,
        });
        continue;
      }

      if (validation.status === 400 || validation.status === 404) {
        results.push({
          model,
          available: false,
          reason: validation.reason ?? `Model unavailable.`,
        });
        continue;
      }

      throw new ProviderValidationError(validation.reason ?? `Model validation failed.`);
    }
  }

  return results;
};

export const loopProviderList = async (loopId: string, userId: string): Promise<LoopProvider[]> => {
  validateLoopId(loopId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new ProviderNotFoundError(`Loop not found.`);
  }

  return queryLoopProviderList(loopId);
};

export const providerAssign = async (loopId: string, userId: string, input: LoopProviderInsert): Promise<void> => {
  validateLoopId(loopId);
  validateProviderId(input.provider);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new ProviderNotFoundError(`Loop not found.`);
  }

  const provider = await queryProviderByIdForOwner(input.provider, userId);

  if (!provider) {
    throw new ProviderNotFoundError(`Provider not found.`);
  }

  await queryLoopProviderAssign(loopId, input.provider);
};

export const loopProviderUpdateByAdmin = async (loopId: string, providerId: string, userId: string, input: LoopProviderAdminUpdate): Promise<LoopProvider> => {
  validateLoopId(loopId);
  validateProviderId(providerId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new ProviderNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new ProviderForbiddenError(`Only loop admins may edit priority and overrides.`);
  }

  const updated = await queryLoopProviderUpdateByAdmin(loopId, providerId, input);

  if (!updated) {
    throw new ProviderNotFoundError(`Loop provider not found.`);
  }

  return updated;
};

export const loopProviderDelete = async (loopId: string, providerId: string, userId: string): Promise<void> => {
  validateLoopId(loopId);
  validateProviderId(providerId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new ProviderNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new ProviderForbiddenError(`Only loop admins may remove assignments.`);
  }

  const result = await queryLoopProviderDelete(loopId, providerId);

  if (result.status === `notFound`) {
    throw new ProviderNotFoundError(`Loop provider not found.`);
  }

  if (result.status === `inUse`) {
    throw new ProviderValidationError(`Provider cannot be removed from loop ${loopId} because it is used by RAG index ${result.ragIndexes.map((index) => index.id).join(`, `)}.`, {
      usingEntities: [{ type: `loop`, id: loopId }],
    });
  }
};
