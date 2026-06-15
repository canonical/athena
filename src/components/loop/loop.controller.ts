import type { Loop, LoopInsert, LoopUpdate } from "./loop.schema.js";
import { queryLoopCreate, queryLoopDelete, queryLoopForUser, queryLoopList, queryLoopUpdate } from "./loop.service.js";

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === `object` && !Array.isArray(value);

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== `string`) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const validateLoopInput = (value: unknown): LoopInsert | LoopUpdate => {
  if (!isRecord(value)) {
    throw new LoopValidationError(`Loop request body must be an object.`);
  }

  const name = normalizeString(value.name);

  if (!name) {
    throw new LoopValidationError(`name is required.`);
  }

  return {
    name,
    description: normalizeString(value.description),
  };
};

export class LoopValidationError extends Error {}
export class LoopNotFoundError extends Error {}

export const validateCreateLoopRequest = (value: unknown): LoopInsert => validateLoopInput(value);
export const validateUpdateLoopRequest = (value: unknown): LoopUpdate => validateLoopInput(value);

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
