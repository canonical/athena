import type { Runner } from "./runner.schema.js";
import { queryRunnerById, queryRunnerList } from "./runner.service.js";

export class RunnerNotFoundError extends Error {}

export const runnerList = async (): Promise<Runner[]> => queryRunnerList();

export const runnerGet = async (runnerId: string): Promise<Runner> => {
  const runner = await queryRunnerById(runnerId);

  if (!runner) {
    throw new RunnerNotFoundError(`Runner not found.`);
  }

  return runner;
};
