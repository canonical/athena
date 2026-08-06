import type { AppLogger } from "@components/logging/logging.schema.js";
import { queryLoopAdminMembership, queryLoopForUser, queryLoopMembership } from "@components/loop/loop.service.js";
import { fetchOpenRouterModels, validateOpenRouterModel } from "@components/openrouter/openrouter.service.js";
import { isValidUuid } from "@components/utilities/zod.utilities.js";
import { ProviderForbiddenError, ProviderNotFoundError, ProviderValidationError } from "./provider.errors.js";
import type { LoopProvider, LoopProviderAdminUpdate, LoopProviderInsert, Provider, ProviderInsert, ProviderModel, ProviderModelPreviewRequest, ProviderModelValidateResultItem, ProviderUpdate } from "./provider.schema.js";
import {
  queryLoopProviderAssign,
  queryLoopProviderDelete,
  queryLoopProviderList,
  queryLoopProviderUpdateByAdmin,
  queryProviderApiConnectionByOwner,
  queryProviderByIdForOwner,
  queryProviderCreate,
  queryProviderDelete,
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

const normalizeProviderModelConfig = <T extends { defaultModel: string | null; enabledModels: string[] | null }>(input: T): T => {
  const enabledModels = input.enabledModels === null ? null : Array.from(new Set(input.enabledModels.map((value) => value.trim()).filter((value) => value.length > 0)));
  const defaultModel = input.defaultModel?.trim() ?? null;

  if (defaultModel && !enabledModels?.includes(defaultModel)) {
    throw new ProviderValidationError(`Default model must also be present in enabledModels.`);
  }

  return {
    ...input,
    defaultModel,
    enabledModels,
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

  if (!(await queryProviderDelete(providerId, ownerId))) {
    throw new ProviderNotFoundError(`Provider not found.`);
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

export const providerValidateModels = async (providerId: string, ownerId: string, models: string[], logger?: AppLogger): Promise<ProviderModelValidateResultItem[]> => {
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
        validation: await validateOpenRouterModel(
          {
            baseUrl: connection.baseUrl,
            apiKey: connection.apiKey,
          },
          {
            model,
            operation: `provider-model-validate`,
            timeoutMs: 20_000,
            logger,
            context: {
              providerId,
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

      if (validation.status === 404) {
        results.push({
          model,
          available: false,
          reason: validation.reason ?? `Model unavailable.`,
        });
        continue;
      }

      throw validation.error ?? new Error(validation.reason ?? `Model validation failed.`);
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

  if (!(await queryLoopProviderDelete(loopId, providerId))) {
    throw new ProviderNotFoundError(`Loop provider not found.`);
  }
};
