import { queryLoopAdminMembership, queryLoopForUser } from "@components/loop/loop.service.js";
import { isValidUuid } from "@components/utilities/zod.utilities.js";
import { StepSequenceForbiddenError, StepSequenceNotFoundError, StepSequenceValidationError } from "./stepSequence.errors.js";
import type { StepDefinition, StepDefinitionWritable, StepSequence, StepSequenceResolution, StepSequenceWithSteps, StepSequenceWritable, TaskSourceStepSequence, TaskSourceStepSequenceWritable } from "./stepSequence.schema.js";
import {
  queryPersonaAssignedToLoop,
  queryProviderAssignedToLoop,
  queryStepDefinitionById,
  queryStepDefinitionByName,
  queryStepDefinitionByOrder,
  queryStepDefinitionCreate,
  queryStepDefinitionDelete,
  queryStepDefinitionList,
  queryStepDefinitionReorder,
  queryStepDefinitionUpdate,
  queryStepSequenceById,
  queryStepSequenceByName,
  queryStepSequenceClearDefault,
  queryStepSequenceCreate,
  queryStepSequenceDefault,
  queryStepSequenceDelete,
  queryStepSequenceList,
  queryStepSequenceUpdate,
  queryTaskSourceStepSequenceByTaskSource,
  queryTaskSourceStepSequenceDelete,
  queryTaskSourceStepSequenceList,
  queryTaskSourceStepSequenceUpsert,
} from "./stepSequence.service.js";

const validateLoopId = (loopId: string): void => {
  if (!isValidUuid(loopId)) {
    throw new StepSequenceValidationError(`loopId must be a valid UUID.`);
  }
};

const validateStepSequenceId = (stepSequenceId: string): void => {
  if (!isValidUuid(stepSequenceId)) {
    throw new StepSequenceValidationError(`stepSequenceId must be a valid UUID.`);
  }
};

const validateStepDefinitionId = (stepDefinitionId: string): void => {
  if (!isValidUuid(stepDefinitionId)) {
    throw new StepSequenceValidationError(`stepDefinitionId must be a valid UUID.`);
  }
};

const requireLoopAdmin = async (loopId: string, userId: string): Promise<void> => {
  if (await queryLoopAdminMembership(loopId, userId)) {
    return;
  }

  if (!(await queryLoopForUser(loopId, userId))) {
    throw new StepSequenceNotFoundError(`Loop not found.`);
  }

  throw new StepSequenceForbiddenError(`Only loop admins may manage step sequences.`);
};

const requireStepSequence = async (stepSequenceId: string, loopId: string): Promise<StepSequence> => {
  const stepSequence = await queryStepSequenceById(stepSequenceId, loopId);

  if (!stepSequence) {
    throw new StepSequenceNotFoundError(`Step sequence not found.`);
  }

  return stepSequence;
};

const validateStepDefinitionInput = async (loopId: string, input: StepDefinitionWritable): Promise<void> => {
  if (input.personaSelectionPolicy === `preSelected`) {
    if (!input.persona || !(await queryPersonaAssignedToLoop(input.persona, loopId))) {
      throw new StepSequenceValidationError(`persona must reference a persona assigned to this loop when personaSelectionPolicy is preSelected.`);
    }
  }

  if (input.modelSelectionPolicy === `preSelected`) {
    if (!input.modelProvider || !input.model || !(await queryProviderAssignedToLoop(input.modelProvider, loopId))) {
      throw new StepSequenceValidationError(`modelProvider must reference a provider assigned to this loop, and model must be set, when modelSelectionPolicy is preSelected.`);
    }
  }
};

export const stepSequenceList = async (loopId: string, userId: string): Promise<StepSequence[]> => {
  validateLoopId(loopId);
  await requireLoopAdmin(loopId, userId);

  return queryStepSequenceList(loopId);
};

export const stepSequenceGet = async (stepSequenceId: string, loopId: string, userId: string): Promise<StepSequenceWithSteps> => {
  validateLoopId(loopId);
  validateStepSequenceId(stepSequenceId);
  await requireLoopAdmin(loopId, userId);

  const stepSequence = await requireStepSequence(stepSequenceId, loopId);
  const stepDefinitions = await queryStepDefinitionList(stepSequenceId);

  return { ...stepSequence, stepDefinitions };
};

export const stepSequenceCreate = async (loopId: string, input: StepSequenceWritable, userId: string): Promise<StepSequence> => {
  validateLoopId(loopId);
  await requireLoopAdmin(loopId, userId);

  const existing = await queryStepSequenceByName(loopId, input.name);

  if (existing) {
    throw new StepSequenceValidationError(`A step sequence named "${input.name}" already exists for this loop.`);
  }

  if (input.isDefault) {
    await queryStepSequenceClearDefault(loopId);
  }

  return queryStepSequenceCreate(loopId, input);
};

export const stepSequenceUpdate = async (stepSequenceId: string, loopId: string, input: StepSequenceWritable, userId: string): Promise<StepSequence> => {
  validateLoopId(loopId);
  validateStepSequenceId(stepSequenceId);
  await requireLoopAdmin(loopId, userId);
  await requireStepSequence(stepSequenceId, loopId);

  const existing = await queryStepSequenceByName(loopId, input.name);

  if (existing && existing.id !== stepSequenceId) {
    throw new StepSequenceValidationError(`A step sequence named "${input.name}" already exists for this loop.`);
  }

  if (input.isDefault) {
    await queryStepSequenceClearDefault(loopId, stepSequenceId);
  }

  const updated = await queryStepSequenceUpdate(stepSequenceId, loopId, input);

  if (!updated) {
    throw new StepSequenceNotFoundError(`Step sequence not found.`);
  }

  return updated;
};

export const stepSequenceDelete = async (stepSequenceId: string, loopId: string, userId: string): Promise<void> => {
  validateLoopId(loopId);
  validateStepSequenceId(stepSequenceId);
  await requireLoopAdmin(loopId, userId);
  await requireStepSequence(stepSequenceId, loopId);

  // Deleting a sequence never mutates or cascades into task data; existing
  // task snapshots (a later sub-task) are unaffected by this removal.
  const deleted = await queryStepSequenceDelete(stepSequenceId, loopId);

  if (!deleted) {
    throw new StepSequenceNotFoundError(`Step sequence not found.`);
  }
};

export const stepDefinitionList = async (stepSequenceId: string, loopId: string, userId: string): Promise<StepDefinition[]> => {
  validateLoopId(loopId);
  validateStepSequenceId(stepSequenceId);
  await requireLoopAdmin(loopId, userId);
  await requireStepSequence(stepSequenceId, loopId);

  return queryStepDefinitionList(stepSequenceId);
};

export const stepDefinitionCreate = async (stepSequenceId: string, loopId: string, input: StepDefinitionWritable, userId: string): Promise<StepDefinition> => {
  validateLoopId(loopId);
  validateStepSequenceId(stepSequenceId);
  await requireLoopAdmin(loopId, userId);
  await requireStepSequence(stepSequenceId, loopId);
  await validateStepDefinitionInput(loopId, input);

  const existingByName = await queryStepDefinitionByName(stepSequenceId, input.name);

  if (existingByName) {
    throw new StepSequenceValidationError(`A step named "${input.name}" already exists in this sequence.`);
  }

  const existingByOrder = await queryStepDefinitionByOrder(stepSequenceId, input.sequenceOrder);

  if (existingByOrder) {
    throw new StepSequenceValidationError(`A step already occupies sequenceOrder ${input.sequenceOrder} in this sequence.`);
  }

  return queryStepDefinitionCreate(stepSequenceId, input);
};

export const stepDefinitionUpdate = async (stepDefinitionId: string, stepSequenceId: string, loopId: string, input: StepDefinitionWritable, userId: string): Promise<StepDefinition> => {
  validateLoopId(loopId);
  validateStepSequenceId(stepSequenceId);
  validateStepDefinitionId(stepDefinitionId);
  await requireLoopAdmin(loopId, userId);
  await requireStepSequence(stepSequenceId, loopId);
  await validateStepDefinitionInput(loopId, input);

  const existing = await queryStepDefinitionById(stepDefinitionId, stepSequenceId);

  if (!existing) {
    throw new StepSequenceNotFoundError(`Step definition not found.`);
  }

  const existingByName = await queryStepDefinitionByName(stepSequenceId, input.name);

  if (existingByName && existingByName.id !== stepDefinitionId) {
    throw new StepSequenceValidationError(`A step named "${input.name}" already exists in this sequence.`);
  }

  const existingByOrder = await queryStepDefinitionByOrder(stepSequenceId, input.sequenceOrder);

  if (existingByOrder && existingByOrder.id !== stepDefinitionId) {
    throw new StepSequenceValidationError(`A step already occupies sequenceOrder ${input.sequenceOrder} in this sequence.`);
  }

  const updated = await queryStepDefinitionUpdate(stepDefinitionId, stepSequenceId, input);

  if (!updated) {
    throw new StepSequenceNotFoundError(`Step definition not found.`);
  }

  return updated;
};

export const stepDefinitionDelete = async (stepDefinitionId: string, stepSequenceId: string, loopId: string, userId: string): Promise<void> => {
  validateLoopId(loopId);
  validateStepSequenceId(stepSequenceId);
  validateStepDefinitionId(stepDefinitionId);
  await requireLoopAdmin(loopId, userId);
  await requireStepSequence(stepSequenceId, loopId);

  const deleted = await queryStepDefinitionDelete(stepDefinitionId, stepSequenceId);

  if (!deleted) {
    throw new StepSequenceNotFoundError(`Step definition not found.`);
  }
};

export const stepDefinitionReorder = async (stepSequenceId: string, loopId: string, orderedStepDefinitionIds: string[], userId: string): Promise<StepDefinition[]> => {
  validateLoopId(loopId);
  validateStepSequenceId(stepSequenceId);

  for (const stepDefinitionId of orderedStepDefinitionIds) {
    validateStepDefinitionId(stepDefinitionId);
  }

  await requireLoopAdmin(loopId, userId);
  await requireStepSequence(stepSequenceId, loopId);

  const existing = await queryStepDefinitionList(stepSequenceId);
  const existingIds = new Set(existing.map((stepDefinition) => stepDefinition.id));
  const providedIds = new Set(orderedStepDefinitionIds);

  if (existingIds.size !== providedIds.size || ![...existingIds].every((id) => providedIds.has(id))) {
    throw new StepSequenceValidationError(`Reordering must include every step definition in the sequence exactly once.`);
  }

  return queryStepDefinitionReorder(stepSequenceId, orderedStepDefinitionIds);
};

export const taskSourceStepSequenceList = async (loopId: string, userId: string): Promise<TaskSourceStepSequence[]> => {
  validateLoopId(loopId);
  await requireLoopAdmin(loopId, userId);

  return queryTaskSourceStepSequenceList(loopId);
};

export const taskSourceStepSequenceUpsert = async (loopId: string, input: TaskSourceStepSequenceWritable, userId: string): Promise<TaskSourceStepSequence> => {
  validateLoopId(loopId);
  await requireLoopAdmin(loopId, userId);
  await requireStepSequence(input.stepSequence, loopId);

  return queryTaskSourceStepSequenceUpsert(loopId, input);
};

export const taskSourceStepSequenceDelete = async (loopId: string, taskSource: string, userId: string): Promise<void> => {
  validateLoopId(loopId);
  await requireLoopAdmin(loopId, userId);

  const deleted = await queryTaskSourceStepSequenceDelete(loopId, taskSource);

  if (!deleted) {
    throw new StepSequenceNotFoundError(`Task source mapping not found.`);
  }
};

/**
 * Resolves the step sequence that applies to newly created tasks for a given
 * loop and task source: a specific task-source mapping wins; otherwise the
 * loop's default sequence is used. Returns null when the loop has neither a
 * mapping nor a default sequence configured.
 */
export const stepSequenceResolveForTaskSource = async (loopId: string, taskSource: string): Promise<StepSequenceResolution> => {
  validateLoopId(loopId);

  const mapping = await queryTaskSourceStepSequenceByTaskSource(loopId, taskSource);

  if (mapping) {
    const stepSequence = await queryStepSequenceById(mapping.stepSequence, loopId);

    if (stepSequence) {
      const stepDefinitions = await queryStepDefinitionList(stepSequence.id);

      return { stepSequence, stepDefinitions, resolvedBy: `mapping` };
    }
  }

  const defaultStepSequence = await queryStepSequenceDefault(loopId);

  if (!defaultStepSequence) {
    return null;
  }

  const stepDefinitions = await queryStepDefinitionList(defaultStepSequence.id);

  return { stepSequence: defaultStepSequence, stepDefinitions, resolvedBy: `default` };
};
