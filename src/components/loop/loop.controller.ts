import { LoopForbiddenError, LoopNotFoundError } from "./loop.errors.js";
import { evaluateLoopReadiness } from "./loop.readiness.js";
import type { Loop, LoopInsert, LoopReadiness, LoopUpdate, ProviderSelectionPolicy, ProviderSelectionPolicyUpdate } from "./loop.schema.js";
import {
  queryLoopAdminMembership,
  queryLoopCreate,
  queryLoopDelete,
  queryLoopForUser,
  queryLoopList,
  queryLoopProviderSelectionPolicy,
  queryLoopProviderSelectionPolicyUpdate,
  queryLoopReadinessCounts,
  queryLoopUpdate,
} from "./loop.service.js";

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

export const loopProviderSelectionPolicyGet = async (loopId: string, userId: string): Promise<ProviderSelectionPolicy> => {
  const policy = await queryLoopProviderSelectionPolicy(loopId, userId);

  if (!policy) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  return policy;
};

export const loopProviderSelectionPolicyUpdate = async (loopId: string, userId: string, input: ProviderSelectionPolicyUpdate): Promise<ProviderSelectionPolicy> => {
  if (!(await queryLoopAdminMembership(loopId, userId))) {
    if (!(await queryLoopForUser(loopId, userId))) {
      throw new LoopNotFoundError(`Loop not found.`);
    }

    throw new LoopForbiddenError(`Only loop admins may update provider selection policy.`);
  }

  const policy = await queryLoopProviderSelectionPolicyUpdate(loopId, userId, input);

  if (!policy) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  return policy;
};

export const loopReadinessGet = async (loopId: string, userId: string): Promise<LoopReadiness> => {
  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new LoopNotFoundError(`Loop not found.`);
  }

  const counts = await queryLoopReadinessCounts(loopId);
  return evaluateLoopReadiness(loopId, counts);
};
