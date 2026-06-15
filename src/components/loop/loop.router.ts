import { getAuthenticatedUser } from "@components/authentication/authentication.controller.js";
import { getSessionId } from "@components/authentication/session.js";
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

const getCurrentUser = async (request: Request, response: Response) => {
  const user = await getAuthenticatedUser(getSessionId(request));

  if (!user) {
    response.sendStatus(401);
    return undefined;
  }

  return user;
};

const getLoopId = (request: Request): string => {
  const loopId = request.params.loopId;

  return Array.isArray(loopId) ? (loopId[0] ?? ``) : (loopId ?? ``);
};

loopRouter.post(`/loops`, async (request: Request, response: Response) => {
  try {
    const user = await getCurrentUser(request, response);

    if (!user) {
      return;
    }

    const loop = await loopCreate(validateCreateLoopRequest(request.body), user.id);
    response.status(201).json(loop);
  } catch (error) {
    if (!sendLoopError(error, response)) {
      throw error;
    }
  }
});

loopRouter.get(`/loops`, async (request: Request, response: Response) => {
  const user = await getCurrentUser(request, response);

  if (!user) {
    return;
  }

  response.status(200).json(await loopList(user.id));
});

loopRouter.get(`/loops/:loopId`, async (request: Request, response: Response) => {
  try {
    const user = await getCurrentUser(request, response);

    if (!user) {
      return;
    }

    response.status(200).json(await loopGet(getLoopId(request), user.id));
  } catch (error) {
    if (!sendLoopError(error, response)) {
      throw error;
    }
  }
});

loopRouter.put(`/loops/:loopId`, async (request: Request, response: Response) => {
  try {
    const user = await getCurrentUser(request, response);

    if (!user) {
      return;
    }

    const loop = await loopUpdate(getLoopId(request), validateUpdateLoopRequest(request.body), user.id);
    response.status(200).json(loop);
  } catch (error) {
    if (!sendLoopError(error, response)) {
      throw error;
    }
  }
});

loopRouter.delete(`/loops/:loopId`, async (request: Request, response: Response) => {
  try {
    const user = await getCurrentUser(request, response);

    if (!user) {
      return;
    }

    await loopDelete(getLoopId(request), user.id);
    response.sendStatus(204);
  } catch (error) {
    if (!sendLoopError(error, response)) {
      throw error;
    }
  }
});
