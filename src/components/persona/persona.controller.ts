import { isValidUuid } from "@components/utilities/validation.js";
import type { Persona, PersonaInsert, PersonaUpdate } from "./persona.schema.js";
import { personaInsertSchema, personaUpdateSchema } from "./persona.schema.js";
import {
  queryLoopMembership,
  queryLoopPersonaById,
  queryLoopPersonaList,
  queryPersonaAssignToLoop,
  queryPersonaById,
  queryPersonaCreate,
  queryPersonaCreateGlobal,
  queryPersonaDefaultList,
  queryPersonaDelete,
  queryPersonaList,
  queryPersonaUpdate,
} from "./persona.service.js";

export class PersonaValidationError extends Error {}
export class PersonaNotFoundError extends Error {}
export class PersonaForbiddenError extends Error {}

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

export const validatePersonaInsertRequest = (value: unknown): PersonaInsert => {
  const result = personaInsertSchema.safeParse(value);

  if (!result.success) {
    throw new PersonaValidationError(result.error.issues[0]?.message ?? `Invalid persona request.`);
  }

  return result.data;
};

export const validatePersonaUpdateRequest = (value: unknown): PersonaUpdate => {
  const result = personaUpdateSchema.safeParse(value);

  if (!result.success) {
    throw new PersonaValidationError(result.error.issues[0]?.message ?? `Invalid persona request.`);
  }

  return result.data;
};

export const personaList = async (loopId: string, userId: string): Promise<Persona[]> => {
  validateLoopId(loopId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  return queryLoopPersonaList(loopId);
};

export const personaListGlobal = async (): Promise<Persona[]> => {
  return queryPersonaList();
};

export const personaGetById = async (personaId: string): Promise<Persona> => {
  validatePersonaId(personaId);

  const persona = await queryPersonaById(personaId);

  if (!persona) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  return persona;
};

export const personaCreate = async (loopId: string, input: PersonaInsert, ownerId: string): Promise<Persona> => {
  validateLoopId(loopId);

  if (!(await queryLoopMembership(loopId, ownerId))) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  return queryPersonaCreate(loopId, input, false, ownerId);
};

export const personaCreateGlobal = async (input: PersonaInsert, ownerId: string): Promise<Persona> => {
  return queryPersonaCreateGlobal(input, false, ownerId);
};

export const personaUpdateGlobal = async (personaId: string, input: PersonaUpdate, requestUserId: string): Promise<Persona> => {
  validatePersonaId(personaId);

  const existing = await queryPersonaById(personaId);

  if (!existing) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  if (existing.owner !== requestUserId) {
    throw new PersonaForbiddenError(`Only the persona owner may edit it.`);
  }

  if (existing.isRouting && input.usesCodingHarness) {
    throw new PersonaValidationError(`A routing persona cannot use a coding harness.`);
  }

  const updated = await queryPersonaUpdate(personaId, input);

  if (!updated) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  return updated;
};

export const personaAssignToLoop = async (loopId: string, personaId: string): Promise<void> => {
  validateLoopId(loopId);
  validatePersonaId(personaId);

  const persona = await queryPersonaById(personaId);

  if (!persona) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  await queryPersonaAssignToLoop(loopId, personaId);
};

export const personaDelete = async (loopId: string, personaId: string, userId: string): Promise<void> => {
  validateLoopId(loopId);
  validatePersonaId(personaId);

  if (!(await queryLoopMembership(loopId, userId))) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  const existing = await queryLoopPersonaById(personaId, loopId);

  if (!existing) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  if (existing.isDefault) {
    throw new PersonaValidationError(`Default personas cannot be deleted.`);
  }

  const deleted = await queryPersonaDelete(personaId, loopId);

  if (!deleted) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }
};

export const personaCatalog = async (): Promise<Persona[]> => {
  return queryPersonaDefaultList();
};
