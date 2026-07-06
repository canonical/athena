import type { AuthenticatedUser } from "@components/authentication/session.schema.js";
import { isValidUuid } from "@components/utilities/validation.js";
import { type Request, type Response, Router } from "express";
import {
  loopProviderCreate,
  loopProviderDelete,
  loopProviderList,
  loopProviderUpdateByAdmin,
  ProviderForbiddenError,
  ProviderNotFoundError,
  ProviderValidationError,
  providerCreate,
  providerDelete,
  providerGet,
  providerList,
  providerUpdate,
  validateLoopProviderAdminUpdateRequest,
  validateLoopProviderInsertRequest,
  validateProviderInsertRequest,
  validateProviderUpdateRequest,
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

const getProviderId = (request: Request, response: Response): string | undefined => {
  const raw = request.params.providerId;
  const providerId = Array.isArray(raw) ? (raw[0] ?? ``) : (raw ?? ``);

  if (!isValidUuid(providerId)) {
    response.status(400).json({ error: `providerId must be a valid UUID.` });
    return undefined;
  }

  return providerId;
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

providerRouter.get(`/provider-list`, async (_request: Request, response: Response) => {
  response.status(200).json(await providerList(getUserId(response)));
});

providerRouter.post(`/provider-list`, async (request: Request, response: Response) => {
  try {
    response.status(201).json(await providerCreate(validateProviderInsertRequest(request.body), getUserId(response)));
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});

providerRouter.get(`/provider/:providerId`, async (request: Request, response: Response) => {
  try {
    const providerId = getProviderId(request, response);

    if (!providerId) {
      return;
    }

    response.status(200).json(await providerGet(providerId, getUserId(response)));
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});

providerRouter.put(`/provider/:providerId`, async (request: Request, response: Response) => {
  try {
    const providerId = getProviderId(request, response);

    if (!providerId) {
      return;
    }

    response.status(200).json(await providerUpdate(providerId, getUserId(response), validateProviderUpdateRequest(request.body)));
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});

providerRouter.delete(`/provider/:providerId`, async (request: Request, response: Response) => {
  try {
    const providerId = getProviderId(request, response);

    if (!providerId) {
      return;
    }

    await providerDelete(providerId, getUserId(response));
    response.sendStatus(204);
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});

providerRouter.get(`/loop/:loopId/provider-list`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    response.status(200).json(await loopProviderList(loopId, getUserId(response)));
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});

providerRouter.post(`/loop/:loopId/provider-list`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    await loopProviderCreate(loopId, getUserId(response), validateLoopProviderInsertRequest(request.body));
    response.sendStatus(204);
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});

providerRouter.put(`/loop/:loopId/provider/:providerId/admin`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const providerId = getProviderId(request, response);

    if (!providerId) {
      return;
    }

    response.status(200).json(await loopProviderUpdateByAdmin(loopId, providerId, getUserId(response), validateLoopProviderAdminUpdateRequest(request.body)));
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});

providerRouter.delete(`/loop/:loopId/provider/:providerId/admin`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const providerId = getProviderId(request, response);

    if (!providerId) {
      return;
    }

    await loopProviderDelete(loopId, providerId, getUserId(response));
    response.sendStatus(204);
  } catch (error) {
    if (!sendProviderError(error, response)) {
      throw error;
    }
  }
});
