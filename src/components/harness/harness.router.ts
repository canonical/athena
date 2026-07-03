import type { AuthenticatedUser } from "@components/authentication/session.schema.js";
import { isValidUuid } from "@components/utilities/validation.js";
import { type Request, type Response, Router } from "express";
import {
  HarnessForbiddenError,
  HarnessNotFoundError,
  HarnessValidationError,
  harnessCreate,
  harnessDelete,
  harnessGet,
  harnessList,
  harnessUpdate,
  loopHarnessCreate,
  loopHarnessDelete,
  loopHarnessList,
  loopHarnessUpdateByAdmin,
  validateHarnessInsertRequest,
  validateHarnessUpdateRequest,
  validateLoopHarnessAdminUpdateRequest,
  validateLoopHarnessInsertRequest,
} from "./harness.controller.js";

export const harnessRouter = Router();

const sendHarnessError = (error: unknown, response: Response): boolean => {
  if (error instanceof HarnessValidationError) {
    response.status(400).json({ error: error.message });
    return true;
  }

  if (error instanceof HarnessNotFoundError) {
    response.status(404).json({ error: error.message });
    return true;
  }

  if (error instanceof HarnessForbiddenError) {
    response.status(403).json({ error: error.message });
    return true;
  }

  return false;
};

const getUserId = (response: Response): string => {
  const user = response.locals.user as AuthenticatedUser | undefined;

  if (!user) {
    throw new Error(`Authenticated user not found in request context.`);
  }

  return user.id;
};

const getHarnessId = (request: Request, response: Response): string | undefined => {
  const raw = request.params.harnessId;
  const harnessId = Array.isArray(raw) ? (raw[0] ?? ``) : (raw ?? ``);

  if (!isValidUuid(harnessId)) {
    response.status(400).json({ error: `harnessId must be a valid UUID.` });
    return undefined;
  }

  return harnessId;
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

harnessRouter.get(`/harness-list`, async (_request: Request, response: Response) => {
  response.status(200).json(await harnessList(getUserId(response)));
});

harnessRouter.post(`/harness-list`, async (request: Request, response: Response) => {
  try {
    response.status(201).json(await harnessCreate(validateHarnessInsertRequest(request.body), getUserId(response)));
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});

harnessRouter.get(`/harness/:harnessId`, async (request: Request, response: Response) => {
  try {
    const harnessId = getHarnessId(request, response);

    if (!harnessId) {
      return;
    }

    response.status(200).json(await harnessGet(harnessId, getUserId(response)));
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});

harnessRouter.put(`/harness/:harnessId`, async (request: Request, response: Response) => {
  try {
    const harnessId = getHarnessId(request, response);

    if (!harnessId) {
      return;
    }

    response.status(200).json(await harnessUpdate(harnessId, getUserId(response), validateHarnessUpdateRequest(request.body)));
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});

harnessRouter.delete(`/harness/:harnessId`, async (request: Request, response: Response) => {
  try {
    const harnessId = getHarnessId(request, response);

    if (!harnessId) {
      return;
    }

    await harnessDelete(harnessId, getUserId(response));
    response.sendStatus(204);
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});

harnessRouter.get(`/loop/:loopId/harness-list`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    response.status(200).json(await loopHarnessList(loopId, getUserId(response)));
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});

harnessRouter.post(`/loop/:loopId/harness-list`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    await loopHarnessCreate(loopId, getUserId(response), validateLoopHarnessInsertRequest(request.body));
    response.sendStatus(204);
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});

harnessRouter.put(`/loop/:loopId/harness/:harnessId/admin`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const harnessId = getHarnessId(request, response);

    if (!harnessId) {
      return;
    }

    response.status(200).json(await loopHarnessUpdateByAdmin(loopId, harnessId, getUserId(response), validateLoopHarnessAdminUpdateRequest(request.body)));
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});

harnessRouter.delete(`/loop/:loopId/harness/:harnessId/admin`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const harnessId = getHarnessId(request, response);

    if (!harnessId) {
      return;
    }

    await loopHarnessDelete(loopId, harnessId, getUserId(response));
    response.sendStatus(204);
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});
