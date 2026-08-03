import { queryLoopAdminMembership, queryLoopForUser, queryLoopMembership } from "@components/loop/loop.service.js";
import { isValidUuid } from "@components/utilities/zod.utilities.js";
import { RunnerForbiddenError, RunnerNotFoundError, RunnerValidationError } from "./runner.errors.js";
import type { LoopRunner, LoopRunnerAdminUpdate, LoopRunnerInsert, Runner, RunnerInsert, RunnerUpdate } from "./runner.schema.js";
import { queryLoopRunnerCreate, queryLoopRunnerDelete, queryLoopRunnerList, queryLoopRunnerUpdateByAdmin, queryRunnerByIdForOwner, queryRunnerCreate, queryRunnerDelete, queryRunnerListByOwner, queryRunnerUpdate } from "./runner.service.js";

const enforceMvpRunnerType = (runnerType: string): void => {
  if (runnerType !== `github-copilot-cloud`) {
    throw new RunnerValidationError(`Only github-copilot-cloud is executable in MVP.`);
  }
};

const validateLoopId = (loopId: string): void => {
  if (!isValidUuid(loopId)) {
    throw new RunnerValidationError(`loopId must be a valid UUID.`);
  }
};

const validateRunnerId = (runnerId: string): void => {
  if (!isValidUuid(runnerId)) {
    throw new RunnerValidationError(`runner must be a valid UUID.`);
  }
};

export const runnerList = async (ownerId: string): Promise<Runner[]> => queryRunnerListByOwner(ownerId);

export const runnerGet = async (runnerId: string, ownerId: string): Promise<Runner> => {
  validateRunnerId(runnerId);

  const runner = await queryRunnerByIdForOwner(runnerId, ownerId);

  if (!runner) {
    throw new RunnerNotFoundError(`Runner not found.`);
  }

  return runner;
};

export const runnerCreate = async (input: RunnerInsert, ownerId: string): Promise<Runner> => {
  enforceMvpRunnerType(input.runnerType);

  return queryRunnerCreate(input, ownerId);
};

export const runnerUpdate = async (runnerId: string, ownerId: string, input: RunnerUpdate): Promise<Runner> => {
  validateRunnerId(runnerId);

  const updated = await queryRunnerUpdate(runnerId, ownerId, input);

  if (!updated) {
    throw new RunnerNotFoundError(`Runner not found.`);
  }

  return updated;
};

export const runnerDelete = async (runnerId: string, ownerId: string): Promise<void> => {
  validateRunnerId(runnerId);

  if (!(await queryRunnerDelete(runnerId, ownerId))) {
    throw new RunnerNotFoundError(`Runner not found.`);
  }
};

export const loopRunnerList = async (loopId: string, userId: string): Promise<LoopRunner[]> => {
  validateLoopId(loopId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new RunnerNotFoundError(`Loop not found.`);
  }

  return queryLoopRunnerList(loopId);
};

export const loopRunnerCreate = async (loopId: string, userId: string, input: LoopRunnerInsert): Promise<void> => {
  validateLoopId(loopId);
  validateRunnerId(input.runner);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new RunnerNotFoundError(`Loop not found.`);
  }

  const runner = await queryRunnerByIdForOwner(input.runner, userId);

  if (!runner) {
    throw new RunnerNotFoundError(`Runner not found.`);
  }

  enforceMvpRunnerType(runner.runnerType);

  await queryLoopRunnerCreate(loopId, input.runner);
};

export const loopRunnerUpdateByAdmin = async (loopId: string, runnerId: string, userId: string, input: LoopRunnerAdminUpdate): Promise<LoopRunner> => {
  validateLoopId(loopId);
  validateRunnerId(runnerId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new RunnerNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new RunnerForbiddenError(`Only loop admins may edit priority and overrides.`);
  }

  const updated = await queryLoopRunnerUpdateByAdmin(loopId, runnerId, input);

  if (!updated) {
    throw new RunnerNotFoundError(`Loop runner not found.`);
  }

  return updated;
};

export const loopRunnerDelete = async (loopId: string, runnerId: string, userId: string): Promise<void> => {
  validateLoopId(loopId);
  validateRunnerId(runnerId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new RunnerNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new RunnerForbiddenError(`Only loop admins may remove assignments.`);
  }

  if (!(await queryLoopRunnerDelete(loopId, runnerId))) {
    throw new RunnerNotFoundError(`Loop runner not found.`);
  }
};
