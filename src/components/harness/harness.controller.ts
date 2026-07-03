import { queryLoopAdminMembership, queryLoopForUser, queryLoopMembership } from "@components/loop/loop.service.js";
import { isValidUuid } from "@components/utilities/validation.js";
import type { HarnessDefinition, HarnessDefinitionInsert, HarnessDefinitionUpdate, LoopHarnessAssignment, LoopHarnessAssignmentAdminUpdate, LoopHarnessAssignmentInsert } from "./harness.schema.js";
import { harnessDefinitionInsertSchema, harnessDefinitionUpdateSchema, loopHarnessAssignmentAdminUpdateSchema, loopHarnessAssignmentInsertSchema } from "./harness.schema.js";
import {
  queryHarnessDefinitionByIdForOwner,
  queryHarnessDefinitionCreate,
  queryHarnessDefinitionDelete,
  queryHarnessDefinitionListByOwner,
  queryHarnessDefinitionUpdate,
  queryLoopHarnessAssignmentCreate,
  queryLoopHarnessAssignmentDelete,
  queryLoopHarnessAssignmentList,
  queryLoopHarnessAssignmentUpdateByAdmin,
} from "./harness.service.js";

export class HarnessValidationError extends Error {}
export class HarnessNotFoundError extends Error {}
export class HarnessForbiddenError extends Error {}

const enforceMvpHarnessType = (harnessType: string): void => {
  if (harnessType !== `github-copilot-cloud-agent`) {
    throw new HarnessValidationError(`Only github-copilot-cloud-agent is executable in MVP.`);
  }
};

const validateLoopId = (loopId: string): void => {
  if (!isValidUuid(loopId)) {
    throw new HarnessValidationError(`loopId must be a valid UUID.`);
  }
};

const validateHarnessDefinitionId = (harnessDefinitionId: string): void => {
  if (!isValidUuid(harnessDefinitionId)) {
    throw new HarnessValidationError(`harnessDefinitionId must be a valid UUID.`);
  }
};

export const validateHarnessDefinitionInsertRequest = (value: unknown): HarnessDefinitionInsert => {
  const result = harnessDefinitionInsertSchema.safeParse(value);

  if (!result.success) {
    throw new HarnessValidationError(result.error.issues[0]?.message ?? `Invalid harness definition request.`);
  }

  enforceMvpHarnessType(result.data.harnessType);

  return result.data;
};

export const validateHarnessDefinitionUpdateRequest = (value: unknown): HarnessDefinitionUpdate => {
  const result = harnessDefinitionUpdateSchema.safeParse(value);

  if (!result.success) {
    throw new HarnessValidationError(result.error.issues[0]?.message ?? `Invalid harness definition request.`);
  }

  return result.data;
};

export const validateLoopHarnessAssignmentInsertRequest = (value: unknown): LoopHarnessAssignmentInsert => {
  const result = loopHarnessAssignmentInsertSchema.safeParse(value);

  if (!result.success) {
    throw new HarnessValidationError(result.error.issues[0]?.message ?? `Invalid loop harness assignment request.`);
  }

  return result.data;
};

export const validateLoopHarnessAssignmentAdminUpdateRequest = (value: unknown): LoopHarnessAssignmentAdminUpdate => {
  const result = loopHarnessAssignmentAdminUpdateSchema.safeParse(value);

  if (!result.success) {
    throw new HarnessValidationError(result.error.issues[0]?.message ?? `Invalid loop harness assignment update request.`);
  }

  return result.data;
};

export const harnessDefinitionList = async (ownerId: string): Promise<HarnessDefinition[]> => queryHarnessDefinitionListByOwner(ownerId);

export const harnessDefinitionGet = async (harnessDefinitionId: string, ownerId: string): Promise<HarnessDefinition> => {
  validateHarnessDefinitionId(harnessDefinitionId);

  const definition = await queryHarnessDefinitionByIdForOwner(harnessDefinitionId, ownerId);

  if (!definition) {
    throw new HarnessNotFoundError(`Harness definition not found.`);
  }

  return definition;
};

export const harnessDefinitionCreate = async (input: HarnessDefinitionInsert, ownerId: string): Promise<HarnessDefinition> => queryHarnessDefinitionCreate(input, ownerId);

export const harnessDefinitionUpdate = async (harnessDefinitionId: string, ownerId: string, input: HarnessDefinitionUpdate): Promise<HarnessDefinition> => {
  validateHarnessDefinitionId(harnessDefinitionId);

  const updated = await queryHarnessDefinitionUpdate(harnessDefinitionId, ownerId, input);

  if (!updated) {
    throw new HarnessNotFoundError(`Harness definition not found.`);
  }

  return updated;
};

export const harnessDefinitionDelete = async (harnessDefinitionId: string, ownerId: string): Promise<void> => {
  validateHarnessDefinitionId(harnessDefinitionId);

  if (!(await queryHarnessDefinitionDelete(harnessDefinitionId, ownerId))) {
    throw new HarnessNotFoundError(`Harness definition not found.`);
  }
};

export const loopHarnessAssignmentList = async (loopId: string, userId: string): Promise<LoopHarnessAssignment[]> => {
  validateLoopId(loopId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new HarnessNotFoundError(`Loop not found.`);
  }

  return queryLoopHarnessAssignmentList(loopId);
};

export const loopHarnessAssignmentCreate = async (loopId: string, userId: string, input: LoopHarnessAssignmentInsert): Promise<void> => {
  validateLoopId(loopId);
  validateHarnessDefinitionId(input.harnessDefinition);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new HarnessNotFoundError(`Loop not found.`);
  }

  const definition = await queryHarnessDefinitionByIdForOwner(input.harnessDefinition, userId);

  if (!definition) {
    throw new HarnessNotFoundError(`Harness definition not found.`);
  }

  enforceMvpHarnessType(definition.harnessType);

  await queryLoopHarnessAssignmentCreate(loopId, input.harnessDefinition);
};

export const loopHarnessAssignmentUpdateByAdmin = async (loopId: string, harnessDefinitionId: string, userId: string, input: LoopHarnessAssignmentAdminUpdate): Promise<LoopHarnessAssignment> => {
  validateLoopId(loopId);
  validateHarnessDefinitionId(harnessDefinitionId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new HarnessNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new HarnessForbiddenError(`Only loop admins may edit priority and overrides.`);
  }

  const updated = await queryLoopHarnessAssignmentUpdateByAdmin(loopId, harnessDefinitionId, input);

  if (!updated) {
    throw new HarnessNotFoundError(`Loop harness assignment not found.`);
  }

  return updated;
};

export const loopHarnessAssignmentDelete = async (loopId: string, harnessDefinitionId: string, userId: string): Promise<void> => {
  validateLoopId(loopId);
  validateHarnessDefinitionId(harnessDefinitionId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new HarnessNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new HarnessForbiddenError(`Only loop admins may remove assignments.`);
  }

  if (!(await queryLoopHarnessAssignmentDelete(loopId, harnessDefinitionId))) {
    throw new HarnessNotFoundError(`Loop harness assignment not found.`);
  }
};
