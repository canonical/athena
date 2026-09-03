import { taskSourceSchema } from "@components/task/task.schema.js";
import { isoDateTime, requiredString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

export const stepSelectionPolicies = [`preSelected`, `routingSelected`] as const;
export type StepSelectionPolicy = (typeof stepSelectionPolicies)[number];

export const stepSequenceSchema = z.object({
  id: uuid(),
  loop: uuid(),
  name: requiredString(`name is required.`),
  isDefault: z.boolean().default(false),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export type StepSequence = z.infer<typeof stepSequenceSchema>;
export type StepSequenceId = StepSequence["id"];

export const stepSequenceWritableSchema = z.object({
  name: requiredString(`name is required.`),
  isDefault: z.boolean().default(false),
});

export type StepSequenceWritable = z.infer<typeof stepSequenceWritableSchema>;

export const stepDefinitionSchema = z
  .object({
    id: uuid(),
    stepSequence: uuid(),
    name: requiredString(`name is required.`),
    sequenceOrder: z.int().min(1),
    instructions: requiredString(`instructions is required.`),
    personaSelectionPolicy: z.enum(stepSelectionPolicies),
    persona: uuid().nullable(),
    modelSelectionPolicy: z.enum(stepSelectionPolicies),
    modelProvider: uuid().nullable(),
    model: z.string().trim().min(1).nullable(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .refine((value) => (value.personaSelectionPolicy === `preSelected` ? value.persona !== null : value.persona === null), {
    message: `persona is required when personaSelectionPolicy is preSelected, and must be omitted otherwise.`,
    path: [`persona`],
  })
  .refine((value) => (value.modelSelectionPolicy === `preSelected` ? value.modelProvider !== null && value.model !== null : value.modelProvider === null && value.model === null), {
    message: `modelProvider and model are required when modelSelectionPolicy is preSelected, and must be omitted otherwise.`,
    path: [`model`],
  });

export type StepDefinition = z.infer<typeof stepDefinitionSchema>;
export type StepDefinitionId = StepDefinition["id"];

export const stepDefinitionWritableSchema = z
  .object({
    name: requiredString(`name is required.`),
    sequenceOrder: z.int().min(1),
    instructions: requiredString(`instructions is required.`),
    personaSelectionPolicy: z.enum(stepSelectionPolicies),
    persona: uuid().nullable().default(null),
    modelSelectionPolicy: z.enum(stepSelectionPolicies),
    modelProvider: uuid().nullable().default(null),
    model: z.string().trim().min(1).nullable().default(null),
  })
  .refine((value) => (value.personaSelectionPolicy === `preSelected` ? value.persona !== null : value.persona === null), {
    message: `persona is required when personaSelectionPolicy is preSelected, and must be omitted otherwise.`,
    path: [`persona`],
  })
  .refine((value) => (value.modelSelectionPolicy === `preSelected` ? value.modelProvider !== null && value.model !== null : value.modelProvider === null && value.model === null), {
    message: `modelProvider and model are required when modelSelectionPolicy is preSelected, and must be omitted otherwise.`,
    path: [`model`],
  });

export type StepDefinitionWritable = z.infer<typeof stepDefinitionWritableSchema>;

export const taskSourceStepSequenceSchema = z.object({
  id: uuid(),
  loop: uuid(),
  taskSource: taskSourceSchema,
  stepSequence: uuid(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export type TaskSourceStepSequence = z.infer<typeof taskSourceStepSequenceSchema>;

export const taskSourceStepSequenceWritableSchema = z.object({
  taskSource: taskSourceSchema,
  stepSequence: uuid(),
});

export type TaskSourceStepSequenceWritable = z.infer<typeof taskSourceStepSequenceWritableSchema>;
