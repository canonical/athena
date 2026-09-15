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

export const stepSequenceWritableSchema = stepSequenceSchema.pick({
  name: true,
  isDefault: true,
});

export type StepSequenceWritable = z.infer<typeof stepSequenceWritableSchema>;

const stepDefinitionFieldsSchema = z.object({
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
});

// Shared policy consistency rule for both the full and writable step
// definition schemas, so the two never drift apart: preSelected requires the
// corresponding value, routingSelected must not carry one.
const withStepSelectionPolicyRules = <Schema extends z.ZodType<{ personaSelectionPolicy: StepSelectionPolicy; persona: string | null; modelSelectionPolicy: StepSelectionPolicy; modelProvider: string | null; model: string | null }>>(
  schema: Schema,
) =>
  schema
    .refine((value) => (value.personaSelectionPolicy === `preSelected` ? value.persona !== null : value.persona === null), {
      message: `persona is required when personaSelectionPolicy is preSelected, and must be omitted otherwise.`,
      path: [`persona`],
    })
    .refine((value) => (value.modelSelectionPolicy === `preSelected` ? value.modelProvider !== null && value.model !== null : value.modelProvider === null && value.model === null), {
      message: `modelProvider and model are required when modelSelectionPolicy is preSelected, and must be omitted otherwise.`,
      path: [`model`],
    });

export const stepDefinitionSchema = withStepSelectionPolicyRules(stepDefinitionFieldsSchema);

export type StepDefinition = z.infer<typeof stepDefinitionSchema>;
export type StepDefinitionId = StepDefinition["id"];

export const stepDefinitionWritableSchema = withStepSelectionPolicyRules(
  stepDefinitionFieldsSchema
    .pick({
      name: true,
      sequenceOrder: true,
      instructions: true,
      personaSelectionPolicy: true,
      persona: true,
      modelSelectionPolicy: true,
      modelProvider: true,
      model: true,
    })
    .extend({
      persona: uuid().nullable().default(null),
      modelProvider: uuid().nullable().default(null),
      model: z.string().trim().min(1).nullable().default(null),
    }),
);

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

export const taskSourceStepSequenceWritableSchema = taskSourceStepSequenceSchema.pick({
  taskSource: true,
  stepSequence: true,
});

export type TaskSourceStepSequenceWritable = z.infer<typeof taskSourceStepSequenceWritableSchema>;

export type StepSequenceWithSteps = StepSequence & { stepDefinitions: StepDefinition[] };

export type StepSequenceResolution = {
  stepSequence: StepSequence;
  stepDefinitions: StepDefinition[];
  resolvedBy: `mapping` | `default`;
} | null;

export const stepSequenceLoopParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
});

export const stepSequenceParamsSchema = stepSequenceLoopParamsSchema.extend({
  stepSequence: uuid(`stepSequence must be a valid UUID.`),
});

export const stepDefinitionParamsSchema = stepSequenceParamsSchema.extend({
  stepDefinition: uuid(`stepDefinition must be a valid UUID.`),
});

export const stepDefinitionReorderBodySchema = z.object({
  stepDefinitions: z.array(uuid(`each entry must be a valid UUID.`)).min(1),
});

export const taskSourceStepSequenceParamsSchema = stepSequenceLoopParamsSchema.extend({
  taskSource: z.string().trim().min(1),
});
