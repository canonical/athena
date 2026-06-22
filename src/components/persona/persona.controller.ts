import { isValidUuid } from "@components/utilities/validation.js";
import type { Persona, PersonaInsert, PersonaUpdate } from "./persona.schema.js";
import { personaInsertSchema, personaUpdateSchema } from "./persona.schema.js";
import { queryPersonaActiveCount, queryPersonaAuditCreate, queryPersonaById, queryPersonaCreate, queryPersonaDelete, queryPersonaList, queryPersonaSeedEM, queryPersonaUpdate } from "./persona.service.js";

export class PersonaValidationError extends Error {}
export class PersonaNotFoundError extends Error {}

const validateLoopId = (loopId: string): void => {
  if (!isValidUuid(loopId)) {
    throw new PersonaValidationError(`loopId must be a valid UUID.`);
  }
};

const validatePersonaConstraintsAfterChange = async (loopId: string): Promise<void> => {
  const counts = await queryPersonaActiveCount(loopId);

  if (counts.withCodingHarness < 1) {
    throw new PersonaValidationError(`At least one active persona with a coding harness is required.`);
  }

  if (counts.engineeringManagers < 1) {
    throw new PersonaValidationError(`At least one active engineering manager persona is required.`);
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

export const personaCreate = async (loopId: string, input: PersonaInsert, userId: string): Promise<Persona> => {
  validateLoopId(loopId);

  const persona = await queryPersonaCreate(loopId, input, false);

  await queryPersonaAuditCreate({
    persona: persona.id,
    loop: loopId,
    actor: userId,
    action: `create`,
    changeSummary: `Created persona "${persona.displayName}".`,
    snapshotBefore: {},
    snapshotAfter: {
      displayName: persona.displayName,
      personality: persona.personality,
      usesCodingHarness: persona.usesCodingHarness,
      isEngineeringManager: persona.isEngineeringManager,
      lifecycleStatus: persona.lifecycleStatus,
      routingPriority: persona.routingPriority,
    },
  });

  return persona;
};

export const personaUpdate = async (loopId: string, personaId: string, input: PersonaUpdate, userId: string): Promise<Persona> => {
  validateLoopId(loopId);

  if (!isValidUuid(personaId)) {
    throw new PersonaValidationError(`personaId must be a valid UUID.`);
  }

  const existing = await queryPersonaById(personaId, loopId);

  if (!existing) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  if (existing.isEngineeringManager && input.usesCodingHarness) {
    throw new PersonaValidationError(`An engineering manager persona cannot use a coding harness.`);
  }

  const updated = await queryPersonaUpdate(personaId, loopId, input);

  if (!updated) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  await validatePersonaConstraintsAfterChange(loopId);

  await queryPersonaAuditCreate({
    persona: personaId,
    loop: loopId,
    actor: userId,
    action: `update`,
    changeSummary: `Updated persona "${updated.displayName}".`,
    snapshotBefore: {
      displayName: existing.displayName,
      personality: existing.personality,
      usesCodingHarness: existing.usesCodingHarness,
      isEngineeringManager: existing.isEngineeringManager,
      lifecycleStatus: existing.lifecycleStatus,
      routingPriority: existing.routingPriority,
    },
    snapshotAfter: {
      displayName: updated.displayName,
      personality: updated.personality,
      usesCodingHarness: updated.usesCodingHarness,
      isEngineeringManager: updated.isEngineeringManager,
      lifecycleStatus: updated.lifecycleStatus,
      routingPriority: updated.routingPriority,
    },
  });

  return updated;
};

export const personaDelete = async (loopId: string, personaId: string, userId: string): Promise<void> => {
  validateLoopId(loopId);

  if (!isValidUuid(personaId)) {
    throw new PersonaValidationError(`personaId must be a valid UUID.`);
  }

  const existing = await queryPersonaById(personaId, loopId);

  if (!existing) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  if (existing.isEngineeringManager) {
    throw new PersonaValidationError(`The engineering manager persona cannot be deleted.`);
  }

  const deleted = await queryPersonaDelete(personaId, loopId);

  if (!deleted) {
    throw new PersonaNotFoundError(`Persona not found.`);
  }

  await queryPersonaAuditCreate({
    persona: null,
    loop: loopId,
    actor: userId,
    action: `delete`,
    changeSummary: `Deleted persona "${existing.displayName}".`,
    snapshotBefore: {
      displayName: existing.displayName,
      personality: existing.personality,
      usesCodingHarness: existing.usesCodingHarness,
      isEngineeringManager: existing.isEngineeringManager,
      lifecycleStatus: existing.lifecycleStatus,
      routingPriority: existing.routingPriority,
    },
    snapshotAfter: {},
  });
};

export const personaSeedEM = async (loopId: string): Promise<Persona> => queryPersonaSeedEM(loopId);
