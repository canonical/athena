import type { AuthenticatedUser } from "@components/authentication/session.schema.js";
import { type Request, type Response, Router } from "express";
import { EventAccessError, EventValidationError, eventCreate, eventList } from "./event.controller.js";

export const eventRouter = Router();

const getUserId = (response: Response): string => {
  const user = response.locals.user as AuthenticatedUser | undefined;

  if (!user) {
    throw new Error(`Authenticated user not found in request context.`);
  }

  return user.id;
};

eventRouter.post(`/loop/events`, async (request: Request, response: Response) => {
  try {
    const result = await eventCreate(request.body, getUserId(response));

    response.status(201).json(result);
  } catch (error) {
    if (error instanceof EventValidationError) {
      response.status(400).json({ error: error.message });
      return;
    }

    if (error instanceof EventAccessError) {
      response.status(404).json({ error: error.message });
      return;
    }

    throw error;
  }
});

eventRouter.get(`/loop/events`, async (_request: Request, response: Response) => {
  const events = await eventList(getUserId(response));

  response.status(200).json(events);
});
