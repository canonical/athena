import type { Loop, LoopInsert, LoopSelectionPolicy, LoopSelectionPolicyUpdate, LoopUpdate } from "./loop.schema.js";
import { loopInsertSchema, loopSelectionPolicyUpdateSchema, loopUpdateSchema } from "./loop.schema.js";
import { queryLoopAdminMembership, queryLoopCreate, queryLoopDelete, queryLoopForUser, queryLoopList, queryLoopSelectionPolicy, queryLoopSelectionPolicyUpdate, queryLoopUpdate } from "./loop.service.js";

export class LoopValidationError extends Error {}
export class LoopNotFoundError extends Error {}
export class LoopForbiddenError extends Error {}

export const validateCreateLoopRequest = (value: unknown): LoopInsert => {
  const result = loopInsertSchema.safeParse(value);

  if (!result.success) {
    throw new LoopValidationError(result.error.issues[0]?.message ?? "Invalid loop request.");
  }

  return result.data;
};

export const validateUpdateLoopRequest = (value: unknown): LoopUpdate => {
  const result = loopUpdateSchema.safeParse(value);

  if (!result.success) {
    throw new LoopValidationError(result.error.issues[0]?.message ?? "Invalid loop request.");
  }

  return result.data;
};

export const validateLoopSelectionPolicyUpdateRequest = (value: unknown): LoopSelectionPolicyUpdate => {
  const result = loopSelectionPolicyUpdateSchema.safeParse(value);

  if (!result.success) {
    throw new LoopValidationError(result.error.issues[0]?.message ?? "Invalid loop selection policy request.");
  }

  return result.data;
};

export const loopList = async (userId: string): Promise<Loop[]> => queryLoopList(userId);

export const loopGet = async (loopId: string, userId: string): Promise<Loop> => {
  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  return loop;
};

export const loopCreate = async (input: LoopInsert, userId: string): Promise<Loop> => queryLoopCreate(input, userId);

export const loopUpdate = async (loopId: string, input: LoopUpdate, userId: string): Promise<Loop> => {
  const loop = await queryLoopUpdate(loopId, input, userId);

  if (!loop) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  return loop;
};

export const loopDelete = async (loopId: string, userId: string): Promise<void> => {
  if (!(await queryLoopDelete(loopId, userId))) {
    throw new LoopNotFoundError(`Loop not found.`);
  }
};

export const loopSelectionPolicyGet = async (loopId: string, userId: string): Promise<LoopSelectionPolicy> => {
  const policy = await queryLoopSelectionPolicy(loopId, userId);

  if (!policy) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  return policy;
};

export const loopSelectionPolicyUpdate = async (loopId: string, userId: string, input: LoopSelectionPolicyUpdate): Promise<LoopSelectionPolicy> => {
  if (!(await queryLoopAdminMembership(loopId, userId))) {
    if (!(await queryLoopForUser(loopId, userId))) {
      throw new LoopNotFoundError(`Loop not found.`);
    }

    throw new LoopForbiddenError(`Only loop admins may update selection policy.`);
  }

  const policy = await queryLoopSelectionPolicyUpdate(loopId, userId, input);

  if (!policy) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  return policy;
};
