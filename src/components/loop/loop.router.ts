import type { AuthenticatedUser } from "@components/authentication/session.schema.js";
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

const getUserId = (response: Response): string => {
  const user = response.locals.user as AuthenticatedUser | undefined;

  if (!user) {
    throw new Error(`Authenticated user not found in request context.`);
  }

  return user.id;
};

loopRouter.post(`/loop-list`, async (request: Request, response: Response) => {
  try {
    const loop = await loopCreate(validateCreateLoopRequest(request.body), getUserId(response));
    response.status(201).json(loop);
  } catch (error) {
    if (!sendLoopError(error, response)) {
      throw error;
    }
  }
});

loopRouter.get(`/loop-list`, async (_request: Request, response: Response) => {
  response.status(200).json(await loopList(getUserId(response)));
});

loopRouter.get(`/loop/:loopId`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    response.status(200).json(await loopGet(loopId, getUserId(response)));
  } catch (error) {
    if (!sendLoopError(error, response)) {
      throw error;
    }
  }
});

loopRouter.put(`/loop/:loopId`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const loop = await loopUpdate(loopId, validateUpdateLoopRequest(request.body), getUserId(response));
    response.status(200).json(loop);
  } catch (error) {
    if (!sendLoopError(error, response)) {
      throw error;
    }
  }
});

loopRouter.delete(`/loop/:loopId`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    await loopDelete(loopId, getUserId(response));
    response.sendStatus(204);
  } catch (error) {
    if (!sendLoopError(error, response)) {
      throw error;
    }
  }
});
