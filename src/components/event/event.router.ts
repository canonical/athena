import { type Request, type Response, Router } from "express";
import { EventAccessError, EventValidationError, eventCreate, eventList } from "./event.controller.js";

export const eventRouter = Router();

eventRouter.post(`/loop/events`, async (request: Request, response: Response) => {
  try {
    const user = request.authenticatedUser!;
    const result = await eventCreate(request.body, user.id);

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

eventRouter.get(`/loop/events`, async (request: Request, response: Response) => {
  const user = request.authenticatedUser!;
  const events = await eventList(user.id);

  response.status(200).json(events);
});
