import { queryLoopAdminMembership, queryLoopForUser, queryLoopMembership } from "@components/loop/loop.service.js";
import { queryLoopRepositoryList } from "@components/repository/repository.service.js";
import { isValidUuid } from "@components/utilities/zod.utilities.js";
import type { CopilotAgentTask } from "./runner.copilot.adapter.js";
import { listCopilotAgentTasks } from "./runner.copilot.adapter.js";
import { RunnerForbiddenError, RunnerNotFoundError, RunnerValidationError } from "./runner.errors.js";
import { queryRunnerQueueListByLoop, queryRunnerQueueListByRunner } from "./runner.queue.service.js";
import type { LoopRunner, LoopRunnerAdminUpdate, LoopRunnerInsert, LoopRunnerRepository, LoopRunnerRepositoryUpdate, Runner, RunnerInsert, RunnerQueueItem, RunnerUpdate } from "./runner.schema.js";
import {
  queryLoopRunnerCreate,
  queryLoopRunnerDelete,
  queryLoopRunnerList,
  queryLoopRunnerRepositoryList,
  queryLoopRunnerRepositoryReplace,
  queryLoopRunnerUpdateByAdmin,
  queryRunnerByIdForOwner,
  queryRunnerCreate,
  queryRunnerDecryptCredential,
  queryRunnerDelete,
  queryRunnerListByOwner,
  queryRunnerUpdate,
} from "./runner.service.js";

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

  if (input.repositoryIds && input.repositoryIds.length > 0) {
    const repositories = await queryLoopRepositoryList(loopId);
    const availableIds = new Set(repositories.map((repository) => repository.repository));
    const requested = [...new Set(input.repositoryIds)];

    const invalidRepository = requested.find((repositoryId) => !availableIds.has(repositoryId));
    if (invalidRepository) {
      throw new RunnerValidationError(`repositoryIds must only contain repositories assigned to this loop.`);
    }

    await queryLoopRunnerRepositoryReplace(loopId, input.runner, requested);
  }
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

export const loopRunnerRepositoryList = async (loopId: string, runnerId: string, userId: string): Promise<LoopRunnerRepository[]> => {
  validateLoopId(loopId);
  validateRunnerId(runnerId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new RunnerNotFoundError(`Loop not found.`);
  }

  const assignedRunners = await queryLoopRunnerList(loopId);
  const assignedRunner = assignedRunners.find((entry) => entry.runner === runnerId);

  if (!assignedRunner) {
    throw new RunnerNotFoundError(`Loop runner not found.`);
  }

  return queryLoopRunnerRepositoryList(loopId, runnerId);
};

export const loopRunnerRepositoryUpdate = async (loopId: string, runnerId: string, userId: string, input: LoopRunnerRepositoryUpdate): Promise<void> => {
  validateLoopId(loopId);
  validateRunnerId(runnerId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new RunnerNotFoundError(`Loop not found.`);
  }

  if (!(await queryLoopAdminMembership(loopId, userId))) {
    throw new RunnerForbiddenError(`Only loop admins may update runner repository assignments.`);
  }

  const assignedRunners = await queryLoopRunnerList(loopId);
  const assignedRunner = assignedRunners.find((entry) => entry.runner === runnerId);

  if (!assignedRunner) {
    throw new RunnerNotFoundError(`Loop runner not found.`);
  }

  const repositories = await queryLoopRepositoryList(loopId);
  const availableIds = new Set(repositories.map((repository) => repository.repository));
  const requested = [...new Set(input.repositoryIds)];

  const invalidRepository = requested.find((repositoryId) => !availableIds.has(repositoryId));
  if (invalidRepository) {
    throw new RunnerValidationError(`repositoryIds must only contain repositories assigned to this loop.`);
  }

  await queryLoopRunnerRepositoryReplace(loopId, runnerId, requested);
};

export type RunnerSessionsResult = {
  runner: Runner;
  queueItems: RunnerQueueItem[];
  githubTasks: CopilotAgentTask[];
  githubError: string | null;
};

export const runnerSessions = async (runnerId: string, ownerId: string): Promise<RunnerSessionsResult> => {
  validateRunnerId(runnerId);

  const runner = await queryRunnerByIdForOwner(runnerId, ownerId);

  if (!runner) {
    throw new RunnerNotFoundError(`Runner not found.`);
  }

  const queueItems = await queryRunnerQueueListByRunner(runnerId);
  const repositories = [...new Set(queueItems.map((item) => item.repository))];

  let githubTasks: CopilotAgentTask[] = [];
  let githubError: string | null = null;

  if (repositories.length > 0) {
    const apiKey = await queryRunnerDecryptCredential(runnerId);

    if (apiKey) {
      try {
        const taskArrays = await Promise.all(repositories.map((repo) => listCopilotAgentTasks(apiKey, repo)));
        githubTasks = taskArrays.flat();
      } catch (err) {
        githubError = err instanceof Error ? err.message : String(err);
      }
    } else {
      githubError = `Runner credential not found.`;
    }
  }

  return { runner, queueItems, githubTasks, githubError };
};

export type LoopRunnerSessionsResult = {
  queueItems: RunnerQueueItem[];
  githubTasks: CopilotAgentTask[];
  githubError: string | null;
};

export const loopRunnerSessions = async (loopId: string, userId: string): Promise<LoopRunnerSessionsResult> => {
  validateLoopId(loopId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new RunnerNotFoundError(`Loop not found.`);
  }

  const queueItems = await queryRunnerQueueListByLoop(loopId);

  // Group repos by runner so each runner's credential is used for its own repos.
  const reposByRunner = new Map<string, Set<string>>();
  for (const item of queueItems) {
    const repos = reposByRunner.get(item.runner) ?? new Set<string>();
    repos.add(item.repository);
    reposByRunner.set(item.runner, repos);
  }

  let githubTasks: CopilotAgentTask[] = [];
  let githubError: string | null = null;

  if (reposByRunner.size > 0) {
    try {
      const allTaskArrays = await Promise.all(
        [...reposByRunner.entries()].map(async ([runnerId, repos]) => {
          const apiKey = await queryRunnerDecryptCredential(runnerId);
          if (!apiKey) return [];
          return (await Promise.all([...repos].map((repo) => listCopilotAgentTasks(apiKey, repo)))).flat();
        }),
      );
      githubTasks = allTaskArrays.flat();
    } catch (err) {
      githubError = err instanceof Error ? err.message : String(err);
    }
  }

  return { queueItems, githubTasks, githubError };
};
