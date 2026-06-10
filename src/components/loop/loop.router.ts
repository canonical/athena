import { type Request, type Response, Router } from "express";

import { getAuthenticatedUser } from "@components/authentication/authentication.controller.js";
import { getSessionId } from "@components/authentication/session.js";
import { LoopValidationError, listLoopEvents, runLoop } from "./loop.controller.js";

export const loopRouter = Router();

loopRouter.post(`/loop/events`, async (request: Request, response: Response) => {
  try {
    const user = await getAuthenticatedUser(getSessionId(request));

    if (!user) {
      response.sendStatus(401);
      return;
    }

    const result = await runLoop(request.body, user.id);

    response.status(201).json(result);
  } catch (error) {
    if (error instanceof LoopValidationError) {
      response.status(400).json({ error: error.message });
      return;
    }

    throw error;
  }
});

loopRouter.get(`/loop/events`, async (request: Request, response: Response) => {
  const user = await getAuthenticatedUser(getSessionId(request));

  if (!user) {
    response.sendStatus(401);
    return;
  }

  const events = await listLoopEvents(user.id);

  response.status(200).json(events);
});
