import { isValidUuid } from "@components/utilities/validation.js";
import { type Request, type Response, Router } from "express";
import { LoopNotFoundError, LoopValidationError, loopCreate, loopDelete, loopGet, loopList, loopUpdate, validateCreateLoopRequest, validateUpdateLoopRequest } from "./loop.controller.js";

export const loopRouter = Router();

const sendLoopError = (error: unknown, response: Response): boolean => {
  if (error instanceof LoopValidationError) {
    response.status(400).json({ error: error.message });
    return true;
  }

  if (error instanceof LoopNotFoundError) {
    response.status(404).json({ error: error.message });
    return true;
  }

  return false;
};

const getLoopId = (request: Request, response: Response): string | undefined => {
  const raw = request.params.loopId;
  const loopId = Array.isArray(raw) ? (raw[0] ?? ``) : (raw ?? ``);

  if (!isValidUuid(loopId)) {
    response.status(400).json({ error: `loopId must be a valid UUID.` });
    return undefined;
  }

  return loopId;
};

loopRouter.post(`/loops`, async (request: Request, response: Response) => {
  try {
    const user = response.locals.authenticatedUser!;
    const loop = await loopCreate(validateCreateLoopRequest(request.body), user.id);
    response.status(201).json(loop);
  } catch (error) {
    if (!sendLoopError(error, response)) {
      throw error;
    }
  }
});

loopRouter.get(`/loops`, async (request: Request, response: Response) => {
  const user = response.locals.authenticatedUser!;
  response.status(200).json(await loopList(user.id));
});

loopRouter.get(`/loops/:loopId`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const user = response.locals.authenticatedUser!;
    response.status(200).json(await loopGet(loopId, user.id));
  } catch (error) {
    if (!sendLoopError(error, response)) {
      throw error;
    }
  }
});

loopRouter.put(`/loops/:loopId`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const user = response.locals.authenticatedUser!;
    const loop = await loopUpdate(loopId, validateUpdateLoopRequest(request.body), user.id);
    response.status(200).json(loop);
  } catch (error) {
    if (!sendLoopError(error, response)) {
      throw error;
    }
  }
});

loopRouter.delete(`/loops/:loopId`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const user = response.locals.authenticatedUser!;
    await loopDelete(loopId, user.id);
    response.sendStatus(204);
  } catch (error) {
    if (!sendLoopError(error, response)) {
      throw error;
    }
  }
});
