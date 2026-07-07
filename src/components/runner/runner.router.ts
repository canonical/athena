import { type Request, type Response, Router } from "express";
import { RunnerNotFoundError, runnerGet, runnerList } from "./runner.controller.js";

export const runnerRouter = Router();

const sendRunnerError = (error: unknown, response: Response): boolean => {
  if (error instanceof RunnerNotFoundError) {
    response.status(404).json({ error: error.message });
    return true;
  }

  return false;
};

runnerRouter.get(`/runner-list`, async (_request: Request, response: Response) => {
  response.status(200).json(await runnerList());
});

runnerRouter.get(`/runner/:runnerId`, async (request: Request, response: Response) => {
  try {
    const raw = request.params.runnerId;
    const runnerId = Array.isArray(raw) ? (raw[0] ?? ``) : (raw ?? ``);

    response.status(200).json(await runnerGet(runnerId));
  } catch (error) {
    if (!sendRunnerError(error, response)) {
      throw error;
    }
  }
});
