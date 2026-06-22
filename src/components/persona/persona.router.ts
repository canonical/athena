import { isValidUuid } from "@components/utilities/validation.js";
import { type Request, type Response, Router } from "express";
import { PersonaNotFoundError, PersonaValidationError, personaCreate, personaDelete, personaList, personaUpdate, validatePersonaInsertRequest, validatePersonaUpdateRequest } from "./persona.controller.js";
import { referencePersonaCatalog } from "./persona.schema.js";

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

personaRouter.get(`/personas/catalog`, (_request: Request, response: Response) => {
  response.status(200).json(referencePersonaCatalog);
});

personaRouter.get(`/loops/:loopId/personas`, async (request: Request, response: Response) => {
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

personaRouter.post(`/loops/:loopId/personas`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const user = response.locals.user!;
    const persona = await personaCreate(loopId, validatePersonaInsertRequest(request.body), user.id);
    response.status(201).json(persona);
  } catch (error) {
    if (!sendPersonaError(error, response)) {
      throw error;
    }
  }
});

personaRouter.put(`/loops/:loopId/personas/:personaId`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const personaId = getPersonaId(request, response);

    if (!personaId) {
      return;
    }

    const user = response.locals.user!;
    const persona = await personaUpdate(loopId, personaId, validatePersonaUpdateRequest(request.body), user.id);
    response.status(200).json(persona);
  } catch (error) {
    if (!sendPersonaError(error, response)) {
      throw error;
    }
  }
});

personaRouter.delete(`/loops/:loopId/personas/:personaId`, async (request: Request, response: Response) => {
  try {
    const loopId = getLoopId(request, response);

    if (!loopId) {
      return;
    }

    const personaId = getPersonaId(request, response);

    if (!personaId) {
      return;
    }

    const user = response.locals.user!;
    await personaDelete(loopId, personaId, user.id);
    response.sendStatus(204);
  } catch (error) {
    if (!sendPersonaError(error, response)) {
      throw error;
    }
  }
});
