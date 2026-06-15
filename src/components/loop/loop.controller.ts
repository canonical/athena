import type { Loop, LoopInsert, LoopUpdate } from "./loop.schema.js";
import { loopInsertSchema, loopUpdateSchema } from "./loop.schema.js";
import { queryLoopCreate, queryLoopDelete, queryLoopForUser, queryLoopList, queryLoopUpdate } from "./loop.service.js";

export class LoopValidationError extends Error {}
export class LoopNotFoundError extends Error {}

export const validateCreateLoopRequest = (value: unknown): LoopInsert => {
  const result = loopInsertSchema.safeParse(value);

  if (!result.success) {
    throw new LoopValidationError(result.error.errors[0]?.message ?? "Invalid loop request.");
  }

  return result.data;
};

export const validateUpdateLoopRequest = (value: unknown): LoopUpdate => {
  const result = loopUpdateSchema.safeParse(value);

  if (!result.success) {
    throw new LoopValidationError(result.error.errors[0]?.message ?? "Invalid loop request.");
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
