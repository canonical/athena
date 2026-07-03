import { queryLoopAdminMembership, queryLoopForUser, queryLoopMembership } from "@components/loop/loop.service.js";
import { isValidUuid } from "@components/utilities/validation.js";
import type { LoopProviderAssignment, LoopProviderAssignmentAdminUpdate, LoopProviderAssignmentInsert, ProviderDefinition, ProviderDefinitionInsert, ProviderDefinitionUpdate } from "./provider.schema.js";
import { loopProviderAssignmentAdminUpdateSchema, loopProviderAssignmentInsertSchema, providerDefinitionInsertSchema, providerDefinitionUpdateSchema } from "./provider.schema.js";
import {
  queryLoopProviderAssignmentCreate,
  queryLoopProviderAssignmentDelete,
  queryLoopProviderAssignmentList,
  queryLoopProviderAssignmentUpdateByAdmin,
  queryProviderDefinitionByIdForOwner,
  queryProviderDefinitionCreate,
  queryProviderDefinitionDelete,
  queryProviderDefinitionListByOwner,
  queryProviderDefinitionUpdate,
} from "./provider.service.js";

export class ProviderValidationError extends Error {}
export class ProviderNotFoundError extends Error {}
export class ProviderForbiddenError extends Error {}

const validateLoopId = (loopId: string): void => {
  if (!isValidUuid(loopId)) {
    throw new ProviderValidationError(`loopId must be a valid UUID.`);
  }
};

const validateProviderDefinitionId = (providerDefinitionId: string): void => {
  if (!isValidUuid(providerDefinitionId)) {
    throw new ProviderValidationError(`providerDefinitionId must be a valid UUID.`);
  }
};

const enforceOpenRouterOnly = (providerType: string): void => {
  if (providerType !== `openrouter`) {
    throw new ProviderValidationError(`Only openrouter providerType is supported in this phase.`);
  }
};

export const validateProviderDefinitionInsertRequest = (value: unknown): ProviderDefinitionInsert => {
  const result = providerDefinitionInsertSchema.safeParse(value);

  if (!result.success) {
    throw new ProviderValidationError(result.error.issues[0]?.message ?? `Invalid provider definition request.`);
  }

  enforceOpenRouterOnly(result.data.providerType);

  return result.data;
};

export const validateProviderDefinitionUpdateRequest = (value: unknown): ProviderDefinitionUpdate => {
  const result = providerDefinitionUpdateSchema.safeParse(value);

  if (!result.success) {
    throw new ProviderValidationError(result.error.issues[0]?.message ?? `Invalid provider definition request.`);
  }

  enforceOpenRouterOnly(result.data.providerType);

  return result.data;
};

export const validateLoopProviderAssignmentInsertRequest = (value: unknown): LoopProviderAssignmentInsert => {
  const result = loopProviderAssignmentInsertSchema.safeParse(value);

  if (!result.success) {
    throw new ProviderValidationError(result.error.issues[0]?.message ?? `Invalid loop provider assignment request.`);
  }

  return result.data;
};

export const validateLoopProviderAssignmentAdminUpdateRequest = (value: unknown): LoopProviderAssignmentAdminUpdate => {
  const result = loopProviderAssignmentAdminUpdateSchema.safeParse(value);

  if (!result.success) {
    throw new ProviderValidationError(result.error.issues[0]?.message ?? `Invalid loop provider assignment update request.`);
  }

  return result.data;
};

export const providerDefinitionList = async (ownerId: string): Promise<ProviderDefinition[]> => queryProviderDefinitionListByOwner(ownerId);

export const providerDefinitionGet = async (providerDefinitionId: string, ownerId: string): Promise<ProviderDefinition> => {
  validateProviderDefinitionId(providerDefinitionId);

  const definition = await queryProviderDefinitionByIdForOwner(providerDefinitionId, ownerId);

  if (!definition) {
    throw new ProviderNotFoundError(`Provider definition not found.`);
  }

  return definition;
};

export const providerDefinitionCreate = async (input: ProviderDefinitionInsert, ownerId: string): Promise<ProviderDefinition> => queryProviderDefinitionCreate(input, ownerId);

export const providerDefinitionUpdate = async (providerDefinitionId: string, ownerId: string, input: ProviderDefinitionUpdate): Promise<ProviderDefinition> => {
  validateProviderDefinitionId(providerDefinitionId);

  const updated = await queryProviderDefinitionUpdate(providerDefinitionId, ownerId, input);

  if (!updated) {
    throw new ProviderNotFoundError(`Provider definition not found.`);
  }

  return updated;
};

export const providerDefinitionDelete = async (providerDefinitionId: string, ownerId: string): Promise<void> => {
  validateProviderDefinitionId(providerDefinitionId);

  if (!(await queryProviderDefinitionDelete(providerDefinitionId, ownerId))) {
    throw new ProviderNotFoundError(`Provider definition not found.`);
  }
};

export const loopProviderAssignmentList = async (loopId: string, userId: string): Promise<LoopProviderAssignment[]> => {
  validateLoopId(loopId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new ProviderNotFoundError(`Loop not found.`);
  }

  return queryLoopProviderAssignmentList(loopId);
};

export const loopProviderAssignmentCreate = async (loopId: string, userId: string, input: LoopProviderAssignmentInsert): Promise<void> => {
  validateLoopId(loopId);
  validateProviderDefinitionId(input.providerDefinition);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new ProviderNotFoundError(`Loop not found.`);
  }

  const definition = await queryProviderDefinitionByIdForOwner(input.providerDefinition, userId);

  if (!definition) {
    throw new ProviderNotFoundError(`Provider definition not found.`);
  }

  await queryLoopProviderAssignmentCreate(loopId, input.providerDefinition);
};

export const loopProviderAssignmentUpdateByAdmin = async (loopId: string, providerDefinitionId: string, userId: string, input: LoopProviderAssignmentAdminUpdate): Promise<LoopProviderAssignment> => {
  validateLoopId(loopId);
  validateProviderDefinitionId(providerDefinitionId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new ProviderNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new ProviderForbiddenError(`Only loop admins may edit priority and overrides.`);
  }

  const updated = await queryLoopProviderAssignmentUpdateByAdmin(loopId, providerDefinitionId, input);

  if (!updated) {
    throw new ProviderNotFoundError(`Loop provider assignment not found.`);
  }

  return updated;
};

export const loopProviderAssignmentDelete = async (loopId: string, providerDefinitionId: string, userId: string): Promise<void> => {
  validateLoopId(loopId);
  validateProviderDefinitionId(providerDefinitionId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new ProviderNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new ProviderForbiddenError(`Only loop admins may remove assignments.`);
  }

  if (!(await queryLoopProviderAssignmentDelete(loopId, providerDefinitionId))) {
    throw new ProviderNotFoundError(`Loop provider assignment not found.`);
  }
};
