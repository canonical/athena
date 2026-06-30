import type { AuthenticatedUser } from "@components/authentication/session.schema.js";
import { isValidUuid } from "@components/utilities/validation.js";
import { type Request, type Response, Router } from "express";
import {
  PersonaForbiddenError,
  PersonaNotFoundError,
  PersonaValidationError,
  personaAssignToLoop,
  personaCatalog,
  personaCreate,
  personaCreateGlobal,
  personaDelete,
  personaGetById,
  personaList,
  personaListGlobal,
  personaUpdateGlobal,
  validatePersonaInsertRequest,
  validatePersonaUpdateRequest,
} from "./persona.controller.js";

export const personaRouter = Router();

const sendPersonaError = (error: unknown, response: Response): boolean => {
  if (error instanceof PersonaValidationError) {
    response.status(400).json({ error: error.message });
    return true;
  }

  if (error instanceof PersonaNotFoundError) {
    response.status(404).json({ error: error.message });
    return true;
  }

  if (error instanceof PersonaForbiddenError) {
    response.status(403).json({ error: error.message });
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

const getPersonaId = (request: Request, response: Response): string | undefined => {
  const raw = request.params.personaId;
  const personaId = Array.isArray(raw) ? (raw[0] ?? ``) : (raw ?? ``);

  if (!isValidUuid(personaId)) {
    response.status(400).json({ error: `personaId must be a valid UUID.` });
    return undefined;
  }

  return personaId;
};

const getUserId = (response: Response): string => {
  const user = response.locals.user as AuthenticatedUser | undefined;

  if (!user) {
    throw new Error(`Authenticated user not found in request context.`);
  }

  return user.id;
};

personaRouter.get(`/persona/catalog`, async (_request: Request, response: Response) => {
  response.status(200).json(await personaCatalog());
});

personaRouter.get(`/persona-list`, async (_request: Request, response: Response) => {
  response.status(200).json(await personaListGlobal());
});

personaRouter.post(`/persona-list`, async (request: Request, response: Response) => {
  try {
    const rawLoopId = request.query.loop;

    if (rawLoopId !== undefined) {
      const loopId = typeof rawLoopId === `string` ? rawLoopId : ``;

      if (!isValidUuid(loopId)) {
        response.status(400).json({ error: `loopId must be a valid UUID.` });
        return;
      }

      const { personaId: rawPersonaId } = request.body as { personaId?: unknown };

      if (!rawPersonaId || typeof rawPersonaId !== `string`) {
        response.status(400).json({ error: `personaId is required.` });
        return;
      }

      await personaAssignToLoop(loopId, rawPersonaId);
      response.sendStatus(204);
      return;
    }

    const persona = await personaCreateGlobal(validatePersonaInsertRequest(request.body), getUserId(response));
    response.status(201).json(persona);
  } catch (error) {
    if (!sendPersonaError(error, response)) {
      throw error;
    }
  }
});

personaRouter.get(`/persona/:personaId`, async (request: Request, response: Response) => {
  try {
    const personaId = getPersonaId(request, response);

    if (!personaId) {
      return;
    }

    response.status(200).json(await personaGetById(personaId));
  } catch (error) {
    if (!sendPersonaError(error, response)) {
      throw error;
    }
  }
});

personaRouter.put(`/persona/:personaId`, async (request: Request, response: Response) => {
  try {
    const personaId = getPersonaId(request, response);

    if (!personaId) {
      return;
    }

    const persona = await personaUpdateGlobal(personaId, validatePersonaUpdateRequest(request.body), getUserId(response));
    response.status(200).json(persona);
  } catch (error) {
    if (!sendPersonaError(error, response)) {
      throw error;
    }
  }
});

personaRouter.get(`/loop/:loopId/persona-list`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    response.status(200).json(await personaList(loopId));
  } catch (error) {
    if (!sendPersonaError(error, response)) {
      throw error;
    }
  }
});

personaRouter.post(`/loop/:loopId/persona-list`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const persona = await personaCreate(loopId, validatePersonaInsertRequest(request.body), getUserId(response));
    response.status(201).json(persona);
  } catch (error) {
    if (!sendPersonaError(error, response)) {
      throw error;
    }
  }
});

personaRouter.delete(`/loop/:loopId/persona/:personaId`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const personaId = getPersonaId(request, response);

    if (!personaId) {
      return;
    }

    await personaDelete(loopId, personaId);
    response.sendStatus(204);
  } catch (error) {
    if (!sendPersonaError(error, response)) {
      throw error;
    }
  }
});
