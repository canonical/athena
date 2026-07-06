import { queryLoopAdminMembership, queryLoopForUser, queryLoopMembership } from "@components/loop/loop.service.js";
import { isValidUuid } from "@components/utilities/validation.js";
import type { Harness, HarnessInsert, HarnessUpdate, LoopHarness, LoopHarnessAdminUpdate, LoopHarnessInsert } from "./harness.schema.js";
import { harnessInsertSchema, harnessUpdateSchema, loopHarnessAdminUpdateSchema, loopHarnessInsertSchema } from "./harness.schema.js";
import {
  queryHarnessByIdForOwner,
  queryHarnessCreate,
  queryHarnessDelete,
  queryHarnessListByOwner,
  queryHarnessUpdate,
  queryLoopHarnessCreate,
  queryLoopHarnessDelete,
  queryLoopHarnessList,
  queryLoopHarnessUpdateByAdmin,
} from "./harness.service.js";

export class HarnessValidationError extends Error {}
export class HarnessNotFoundError extends Error {}
export class HarnessForbiddenError extends Error {}

const enforceMvpRunnerType = (runnerType: string): void => {
  if (runnerType !== `github-copilot-cloud`) {
    throw new HarnessValidationError(`Only github-copilot-cloud is executable in MVP.`);
  }
};

const validateLoopId = (loopId: string): void => {
  if (!isValidUuid(loopId)) {
    throw new HarnessValidationError(`loopId must be a valid UUID.`);
  }
};

const validateHarnessId = (harnessId: string): void => {
  if (!isValidUuid(harnessId)) {
    throw new HarnessValidationError(`harnessId must be a valid UUID.`);
  }
};

export const validateHarnessInsertRequest = (value: unknown): HarnessInsert => {
  const result = harnessInsertSchema.safeParse(value);

  if (!result.success) {
    throw new HarnessValidationError(result.error.issues[0]?.message ?? `Invalid harness request.`);
  }

  enforceMvpRunnerType(result.data.runnerType);

  return result.data;
};

export const validateHarnessUpdateRequest = (value: unknown): HarnessUpdate => {
  const result = harnessUpdateSchema.safeParse(value);

  if (!result.success) {
    throw new HarnessValidationError(result.error.issues[0]?.message ?? `Invalid harness request.`);
  }

  return result.data;
};

export const validateLoopHarnessInsertRequest = (value: unknown): LoopHarnessInsert => {
  const result = loopHarnessInsertSchema.safeParse(value);

  if (!result.success) {
    throw new HarnessValidationError(result.error.issues[0]?.message ?? `Invalid loop harness request.`);
  }

  return result.data;
};

export const validateLoopHarnessAdminUpdateRequest = (value: unknown): LoopHarnessAdminUpdate => {
  const result = loopHarnessAdminUpdateSchema.safeParse(value);

  if (!result.success) {
    throw new HarnessValidationError(result.error.issues[0]?.message ?? `Invalid loop harness update request.`);
  }

  return result.data;
};

export const harnessList = async (ownerId: string): Promise<Harness[]> => queryHarnessListByOwner(ownerId);

export const harnessGet = async (harnessId: string, ownerId: string): Promise<Harness> => {
  validateHarnessId(harnessId);

  const harness = await queryHarnessByIdForOwner(harnessId, ownerId);

  if (!harness) {
    throw new HarnessNotFoundError(`Harness not found.`);
  }

  return harness;
};

export const harnessCreate = async (input: HarnessInsert, ownerId: string): Promise<Harness> => queryHarnessCreate(input, ownerId);

export const harnessUpdate = async (harnessId: string, ownerId: string, input: HarnessUpdate): Promise<Harness> => {
  validateHarnessId(harnessId);

  const updated = await queryHarnessUpdate(harnessId, ownerId, input);

  if (!updated) {
    throw new HarnessNotFoundError(`Harness not found.`);
  }

  return updated;
};

export const harnessDelete = async (harnessId: string, ownerId: string): Promise<void> => {
  validateHarnessId(harnessId);

  if (!(await queryHarnessDelete(harnessId, ownerId))) {
    throw new HarnessNotFoundError(`Harness not found.`);
  }
};

export const loopHarnessList = async (loopId: string, userId: string): Promise<LoopHarness[]> => {
  validateLoopId(loopId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new HarnessNotFoundError(`Loop not found.`);
  }

  return queryLoopHarnessList(loopId);
};

export const loopHarnessCreate = async (loopId: string, userId: string, input: LoopHarnessInsert): Promise<void> => {
  validateLoopId(loopId);
  validateHarnessId(input.harness);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new HarnessNotFoundError(`Loop not found.`);
  }

  const harness = await queryHarnessByIdForOwner(input.harness, userId);

  if (!harness) {
    throw new HarnessNotFoundError(`Harness not found.`);
  }

  enforceMvpRunnerType(harness.runnerType);

  await queryLoopHarnessCreate(loopId, input.harness);
};

export const loopHarnessUpdateByAdmin = async (loopId: string, harnessId: string, userId: string, input: LoopHarnessAdminUpdate): Promise<LoopHarness> => {
  validateLoopId(loopId);
  validateHarnessId(harnessId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new HarnessNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new HarnessForbiddenError(`Only loop admins may edit priority and overrides.`);
  }

  const updated = await queryLoopHarnessUpdateByAdmin(loopId, harnessId, input);

  if (!updated) {
    throw new HarnessNotFoundError(`Loop harness not found.`);
  }

  return updated;
};

export const loopHarnessDelete = async (loopId: string, harnessId: string, userId: string): Promise<void> => {
  validateLoopId(loopId);
  validateHarnessId(harnessId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new HarnessNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new HarnessForbiddenError(`Only loop admins may remove assignments.`);
  }

  if (!(await queryLoopHarnessDelete(loopId, harnessId))) {
    throw new HarnessNotFoundError(`Loop harness not found.`);
  }
};
