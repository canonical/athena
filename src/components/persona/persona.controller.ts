import { isValidUuid } from "@components/utilities/validation.js";
import type { Persona, PersonaInsert, PersonaUpdate } from "./persona.schema.js";
import { personaInsertSchema, personaUpdateSchema } from "./persona.schema.js";
import {
  queryAllPersonas,
  queryPersonaActiveCount,
  queryPersonaAssignToLoop,
  queryPersonaById,
  queryPersonaByIdGlobal,
  queryPersonaCreate,
  queryPersonaCreateGlobal,
  queryPersonaDelete,
  queryPersonaList,
  queryPersonaUpdate,
  queryPersonaUpdateGlobal,
} from "./persona.service.js";

export class PersonaValidationError extends Error {}
export class PersonaNotFoundError extends Error {}

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

const validatePersonaConstraintsAfterChange = async (loopId: string): Promise<void> => {
  const counts = await queryPersonaActiveCount(loopId);

  if (counts.withCodingHarness < 1) {
    throw new PersonaValidationError(`At least one active persona with a coding harness is required.`);
  }

  if (counts.routing < 1) {
    throw new PersonaValidationError(`At least one active routing persona is required.`);
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

export const personaList = async (loopId: string): Promise<Persona[]> => {
  validateLoopId(loopId);

  return queryPersonaList(loopId);
};

export const personaListGlobal = async (): Promise<Persona[]> => {
  return queryAllPersonas();
};

export const personaGetById = async (personaId: string): Promise<Persona> => {
  validatePersonaId(personaId);

  const persona = await queryPersonaByIdGlobal(personaId);

  if (!persona) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  return persona;
};

export const personaCreate = async (loopId: string, input: PersonaInsert): Promise<Persona> => {
  validateLoopId(loopId);

  return queryPersonaCreate(loopId, input, false);
};

export const personaCreateGlobal = async (input: PersonaInsert): Promise<Persona> => {
  return queryPersonaCreateGlobal(input, false);
};

export const personaUpdate = async (loopId: string, personaId: string, input: PersonaUpdate): Promise<Persona> => {
  validateLoopId(loopId);
  validatePersonaId(personaId);

  const existing = await queryPersonaById(personaId, loopId);

  if (!existing) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  if (existing.isRouting && input.usesCodingHarness) {
    throw new PersonaValidationError(`A routing persona cannot use a coding harness.`);
  }

  const updated = await queryPersonaUpdate(personaId, loopId, input);

  if (!updated) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  await validatePersonaConstraintsAfterChange(loopId);

  return updated;
};

export const personaUpdateGlobal = async (personaId: string, input: PersonaUpdate): Promise<Persona> => {
  validatePersonaId(personaId);

  const existing = await queryPersonaByIdGlobal(personaId);

  if (!existing) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  if (existing.isRouting && input.usesCodingHarness) {
    throw new PersonaValidationError(`A routing persona cannot use a coding harness.`);
  }

  const updated = await queryPersonaUpdateGlobal(personaId, input);

  if (!updated) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  return updated;
};

export const personaAssignToLoop = async (loopId: string, personaId: string): Promise<void> => {
  validateLoopId(loopId);
  validatePersonaId(personaId);

  const persona = await queryPersonaByIdGlobal(personaId);

  if (!persona) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  await queryPersonaAssignToLoop(loopId, personaId);
};

export const personaDelete = async (loopId: string, personaId: string): Promise<void> => {
  validateLoopId(loopId);
  validatePersonaId(personaId);

  const existing = await queryPersonaById(personaId, loopId);

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
