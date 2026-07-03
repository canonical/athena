import type { AuthenticatedUser } from "@components/authentication/session.schema.js";
import { isValidUuid } from "@components/utilities/validation.js";
import { type Request, type Response, Router } from "express";
import {
  HarnessForbiddenError,
  HarnessNotFoundError,
  HarnessValidationError,
  harnessDefinitionCreate,
  harnessDefinitionDelete,
  harnessDefinitionGet,
  harnessDefinitionList,
  harnessDefinitionUpdate,
  loopHarnessAssignmentCreate,
  loopHarnessAssignmentDelete,
  loopHarnessAssignmentList,
  loopHarnessAssignmentUpdateByAdmin,
  validateHarnessDefinitionInsertRequest,
  validateHarnessDefinitionUpdateRequest,
  validateLoopHarnessAssignmentAdminUpdateRequest,
  validateLoopHarnessAssignmentInsertRequest,
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

const getHarnessDefinitionId = (request: Request, response: Response): string | undefined => {
  const raw = request.params.harnessDefinitionId;
  const harnessDefinitionId = Array.isArray(raw) ? (raw[0] ?? ``) : (raw ?? ``);

  if (!isValidUuid(harnessDefinitionId)) {
    response.status(400).json({ error: `harnessDefinitionId must be a valid UUID.` });
    return undefined;
  }

  return harnessDefinitionId;
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

harnessRouter.get(`/harness-definition-list`, async (_request: Request, response: Response) => {
  response.status(200).json(await harnessDefinitionList(getUserId(response)));
});

harnessRouter.post(`/harness-definition-list`, async (request: Request, response: Response) => {
  try {
    response.status(201).json(await harnessDefinitionCreate(validateHarnessDefinitionInsertRequest(request.body), getUserId(response)));
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});

harnessRouter.get(`/harness-definition/:harnessDefinitionId`, async (request: Request, response: Response) => {
  try {
    const harnessDefinitionId = getHarnessDefinitionId(request, response);

    if (!harnessDefinitionId) {
      return;
    }

    response.status(200).json(await harnessDefinitionGet(harnessDefinitionId, getUserId(response)));
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});

harnessRouter.put(`/harness-definition/:harnessDefinitionId`, async (request: Request, response: Response) => {
  try {
    const harnessDefinitionId = getHarnessDefinitionId(request, response);

    if (!harnessDefinitionId) {
      return;
    }

    response.status(200).json(await harnessDefinitionUpdate(harnessDefinitionId, getUserId(response), validateHarnessDefinitionUpdateRequest(request.body)));
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});

harnessRouter.delete(`/harness-definition/:harnessDefinitionId`, async (request: Request, response: Response) => {
  try {
    const harnessDefinitionId = getHarnessDefinitionId(request, response);

    if (!harnessDefinitionId) {
      return;
    }

    await harnessDefinitionDelete(harnessDefinitionId, getUserId(response));
    response.sendStatus(204);
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});

harnessRouter.get(`/loop/:loopId/harness-assignment-list`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    response.status(200).json(await loopHarnessAssignmentList(loopId, getUserId(response)));
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});

harnessRouter.post(`/loop/:loopId/harness-assignment-list`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    await loopHarnessAssignmentCreate(loopId, getUserId(response), validateLoopHarnessAssignmentInsertRequest(request.body));
    response.sendStatus(204);
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});

harnessRouter.put(`/loop/:loopId/harness-assignment/:harnessDefinitionId/admin`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const harnessDefinitionId = getHarnessDefinitionId(request, response);

    if (!harnessDefinitionId) {
      return;
    }

    response.status(200).json(await loopHarnessAssignmentUpdateByAdmin(loopId, harnessDefinitionId, getUserId(response), validateLoopHarnessAssignmentAdminUpdateRequest(request.body)));
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});

harnessRouter.delete(`/loop/:loopId/harness-assignment/:harnessDefinitionId/admin`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const harnessDefinitionId = getHarnessDefinitionId(request, response);

    if (!harnessDefinitionId) {
      return;
    }

    await loopHarnessAssignmentDelete(loopId, harnessDefinitionId, getUserId(response));
    response.sendStatus(204);
  } catch (error) {
    if (!sendHarnessError(error, response)) {
      throw error;
    }
  }
});
