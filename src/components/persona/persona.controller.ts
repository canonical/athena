import { queryLoopForUser } from "@components/loop/loop.service.js";
import { isValidUuid } from "@components/utilities/zod.utilities.js";
import { PersonaForbiddenError, PersonaNotFoundError, PersonaValidationError } from "./persona.errors.js";
import type { Persona, PersonaWritable } from "./persona.schema.js";
import {
  queryLoopMembership,
  queryLoopPersonaById,
  queryLoopPersonaList,
  queryPersonaAssignToLoop,
  queryPersonaById,
  queryPersonaCreate,
  queryPersonaDefaultList,
  queryPersonaDelete,
  queryPersonaForUser,
  queryPersonaList,
  queryPersonaUnassign,
  queryPersonaUpdate,
} from "./persona.service.js";

const validateLoopId = (loopId: string): void => {
  if (!isValidUuid(loopId)) {
    throw new PersonaValidationError(`loopId must be a valid UUID.`);
  }
};

const validatePersonaId = (personaId: string): void => {
  if (!isValidUuid(personaId)) {
    throw new PersonaValidationError(`personaId must be a valid UUID.`);
  }
};

export const personaListForLoop = async (loopId: string, userId: string): Promise<Persona[]> => {
  validateLoopId(loopId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  return queryLoopPersonaList(loopId);
};

export const personaListForUser = async (userId: string): Promise<Persona[]> => {
  return queryPersonaList(userId);
};

export const personaGetById = async (personaId: string): Promise<Persona> => {
  validatePersonaId(personaId);

  const persona = await queryPersonaById(personaId);

  if (!persona) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  return persona;
};

export const personaCreate = async (input: PersonaWritable, ownerId: string): Promise<Persona> => {
  return queryPersonaCreate(input, false, ownerId);
};

export const personaDelete = async (personaId: string, requestUserId: string): Promise<void> => {
  validatePersonaId(personaId);

  const existing = await queryPersonaById(personaId);

  if (!existing) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  if (existing.owner !== requestUserId) {
    throw new PersonaForbiddenError(`Only the persona owner may delete it.`);
  }

  const deleted = await queryPersonaDelete(personaId, requestUserId);

  if (!deleted) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }
};

export const personaUpdateGlobal = async (personaId: string, input: PersonaWritable, requestUserId: string): Promise<Persona> => {
  validatePersonaId(personaId);

  const existing = await queryPersonaById(personaId);

  if (!existing) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  if (existing.owner !== requestUserId) {
    throw new PersonaForbiddenError(`Only the persona owner may edit it.`);
  }

  const updated = await queryPersonaUpdate(personaId, input);

  if (!updated) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  return updated;
};

export const personaAssignToLoop = async (loopId: string, personaId: string, userId: string): Promise<void> => {
  validateLoopId(loopId);
  validatePersonaId(personaId);

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new PersonaNotFoundError(`Cannot assign persona: loop not found or access denied.`);
  }

  // First try to get persona owned by user
  let persona = await queryPersonaForUser(personaId, userId);

  // If not owned by user, check if it's a default persona from catalog
  if (!persona) {
    persona = await queryPersonaById(personaId);

    if (!persona) {
      throw new PersonaNotFoundError(`Cannot assign persona: persona not found.`);
    }

    if (!persona.isDefault) {
      throw new PersonaForbiddenError(`Cannot assign persona: only owned personas or default catalog personas can be assigned.`);
    }
  }

  await queryPersonaAssignToLoop(loopId, personaId);
};

export const personaUnassign = async (loopId: string, personaId: string, userId: string): Promise<void> => {
  validateLoopId(loopId);
  validatePersonaId(personaId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  const existing = await queryLoopPersonaById(personaId, loopId);

  if (!existing) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  const deleted = await queryPersonaUnassign(personaId, loopId);

  if (!deleted) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }
};

export const personaCatalog = async (): Promise<Persona[]> => {
  return queryPersonaDefaultList();
};
