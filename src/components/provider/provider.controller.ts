import { queryLoopAdminMembership, queryLoopForUser, queryLoopMembership } from "@components/loop/loop.service.js";
import { isValidUuid } from "@components/utilities/validation.js";
import type { LoopProvider, LoopProviderAdminUpdate, LoopProviderInsert, Provider, ProviderInsert, ProviderUpdate } from "./provider.schema.js";
import { loopProviderAdminUpdateSchema, loopProviderInsertSchema, providerInsertSchema, providerUpdateSchema } from "./provider.schema.js";
import {
  queryLoopProviderCreate,
  queryLoopProviderDelete,
  queryLoopProviderList,
  queryLoopProviderUpdateByAdmin,
  queryProviderByIdForOwner,
  queryProviderCreate,
  queryProviderDelete,
  queryProviderListByOwner,
  queryProviderUpdate,
} from "./provider.service.js";

export class ProviderValidationError extends Error {}
export class ProviderNotFoundError extends Error {}
export class ProviderForbiddenError extends Error {}

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

export const validateProviderInsertRequest = (value: unknown): ProviderInsert => {
  const result = providerInsertSchema.safeParse(value);

  if (!result.success) {
    throw new ProviderValidationError(result.error.issues[0]?.message ?? `Invalid provider request.`);
  }

  enforceOpenRouterOnly(result.data.providerType);

  return result.data;
};

export const validateProviderUpdateRequest = (value: unknown): ProviderUpdate => {
  const result = providerUpdateSchema.safeParse(value);

  if (!result.success) {
    throw new ProviderValidationError(result.error.issues[0]?.message ?? `Invalid provider request.`);
  }

  enforceOpenRouterOnly(result.data.providerType);

  return result.data;
};

export const validateLoopProviderInsertRequest = (value: unknown): LoopProviderInsert => {
  const result = loopProviderInsertSchema.safeParse(value);

  if (!result.success) {
    throw new ProviderValidationError(result.error.issues[0]?.message ?? `Invalid loop provider request.`);
  }

  return result.data;
};

export const validateLoopProviderAdminUpdateRequest = (value: unknown): LoopProviderAdminUpdate => {
  const result = loopProviderAdminUpdateSchema.safeParse(value);

  if (!result.success) {
    throw new ProviderValidationError(result.error.issues[0]?.message ?? `Invalid loop provider update request.`);
  }

  return result.data;
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

export const providerCreate = async (input: ProviderInsert, ownerId: string): Promise<Provider> => queryProviderCreate(input, ownerId);

export const providerUpdate = async (providerId: string, ownerId: string, input: ProviderUpdate): Promise<Provider> => {
  validateProviderId(providerId);

  const updated = await queryProviderUpdate(providerId, ownerId, input);

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

export const loopProviderList = async (loopId: string, userId: string): Promise<LoopProvider[]> => {
  validateLoopId(loopId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new ProviderNotFoundError(`Loop not found.`);
  }

  return queryLoopProviderList(loopId);
};

export const loopProviderCreate = async (loopId: string, userId: string, input: LoopProviderInsert): Promise<void> => {
  validateLoopId(loopId);
  validateProviderId(input.provider);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new ProviderNotFoundError(`Loop not found.`);
  }

  const provider = await queryProviderByIdForOwner(input.provider, userId);

  if (!provider) {
    throw new ProviderNotFoundError(`Provider not found.`);
  }

  await queryLoopProviderCreate(loopId, input.provider);
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
