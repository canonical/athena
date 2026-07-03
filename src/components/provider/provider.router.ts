import type { AuthenticatedUser } from "@components/authentication/session.schema.js";
import { isValidUuid } from "@components/utilities/validation.js";
import { type Request, type Response, Router } from "express";
import {
  ProviderForbiddenError,
  ProviderNotFoundError,
  ProviderValidationError,
  loopProviderAssignmentCreate,
  loopProviderAssignmentDelete,
  loopProviderAssignmentList,
  loopProviderAssignmentUpdateByAdmin,
  providerDefinitionCreate,
  providerDefinitionDelete,
  providerDefinitionGet,
  providerDefinitionList,
  providerDefinitionUpdate,
  validateLoopProviderAssignmentAdminUpdateRequest,
  validateLoopProviderAssignmentInsertRequest,
  validateProviderDefinitionInsertRequest,
  validateProviderDefinitionUpdateRequest,
} from "./provider.controller.js";

export const providerRouter = Router();

const sendProviderError = (error: unknown, response: Response): boolean => {
  if (error instanceof ProviderValidationError) {
    response.status(400).json({ error: error.message });
    return true;
  }

  if (error instanceof ProviderNotFoundError) {
    response.status(404).json({ error: error.message });
    return true;
  }

  if (error instanceof ProviderForbiddenError) {
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

const getProviderDefinitionId = (request: Request, response: Response): string | undefined => {
  const raw = request.params.providerDefinitionId;
  const providerDefinitionId = Array.isArray(raw) ? (raw[0] ?? ``) : (raw ?? ``);

  if (!isValidUuid(providerDefinitionId)) {
    response.status(400).json({ error: `providerDefinitionId must be a valid UUID.` });
    return undefined;
  }

  return providerDefinitionId;
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

providerRouter.get(`/provider-definition-list`, async (_request: Request, response: Response) => {
  response.status(200).json(await providerDefinitionList(getUserId(response)));
});

providerRouter.post(`/provider-definition-list`, async (request: Request, response: Response) => {
  try {
    response.status(201).json(await providerDefinitionCreate(validateProviderDefinitionInsertRequest(request.body), getUserId(response)));
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});

providerRouter.get(`/provider-definition/:providerDefinitionId`, async (request: Request, response: Response) => {
  try {
    const providerDefinitionId = getProviderDefinitionId(request, response);

    if (!providerDefinitionId) {
      return;
    }

    response.status(200).json(await providerDefinitionGet(providerDefinitionId, getUserId(response)));
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});

providerRouter.put(`/provider-definition/:providerDefinitionId`, async (request: Request, response: Response) => {
  try {
    const providerDefinitionId = getProviderDefinitionId(request, response);

    if (!providerDefinitionId) {
      return;
    }

    response.status(200).json(await providerDefinitionUpdate(providerDefinitionId, getUserId(response), validateProviderDefinitionUpdateRequest(request.body)));
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});

providerRouter.delete(`/provider-definition/:providerDefinitionId`, async (request: Request, response: Response) => {
  try {
    const providerDefinitionId = getProviderDefinitionId(request, response);

    if (!providerDefinitionId) {
      return;
    }

    await providerDefinitionDelete(providerDefinitionId, getUserId(response));
    response.sendStatus(204);
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});

providerRouter.get(`/loop/:loopId/provider-assignment-list`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    response.status(200).json(await loopProviderAssignmentList(loopId, getUserId(response)));
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});

providerRouter.post(`/loop/:loopId/provider-assignment-list`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    await loopProviderAssignmentCreate(loopId, getUserId(response), validateLoopProviderAssignmentInsertRequest(request.body));
    response.sendStatus(204);
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});

providerRouter.put(`/loop/:loopId/provider-assignment/:providerDefinitionId/admin`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const providerDefinitionId = getProviderDefinitionId(request, response);

    if (!providerDefinitionId) {
      return;
    }

    response.status(200).json(await loopProviderAssignmentUpdateByAdmin(loopId, providerDefinitionId, getUserId(response), validateLoopProviderAssignmentAdminUpdateRequest(request.body)));
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});

providerRouter.delete(`/loop/:loopId/provider-assignment/:providerDefinitionId/admin`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const providerDefinitionId = getProviderDefinitionId(request, response);

    if (!providerDefinitionId) {
      return;
    }

    await loopProviderAssignmentDelete(loopId, providerDefinitionId, getUserId(response));
    response.sendStatus(204);
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});
