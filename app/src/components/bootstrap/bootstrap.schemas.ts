import { z } from "zod";

export const bootstrapDecisionSchema = z.object({
  slug: z.string(),
  reason: z.string(),
});

export const bootstrapDecisionResponseFormat = {
  type: `object`,
  properties: {
    slug: {
      type: `string`,
    },
    reason: {
      type: `string`,
    },
  },
  required: [`slug`, `reason`],
  additionalProperties: false,
} as const;

export const catalogModelCandidateSchema = z.object({
  model: z.string(),
  family: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  capabilities: z.array(z.string()),
  parameterSizes: z.array(z.string()),
  variantTag: z.string(),
  contextWindow: z.string().nullable(),
  inputType: z.string().nullable(),
  sizeLabel: z.string().nullable(),
  catalogHref: z.string(),
  updated: z.string().nullable(),
  preferredCurrentVariant: z.boolean(),
  score: z.number(),
  sizeBytes: z.number().nullable(),
  installed: z.boolean(),
  reason: z.string(),
});

export const modelCapacityBudgetSchema = z.object({
  hasGpu: z.boolean(),
  ratio: z.number(),
  systemMemoryBudgetBytes: z.number().nullable(),
  gpuMemoryBudgetBytes: z.number().nullable(),
  effectiveModelBudgetBytes: z.number().nullable(),
});

export type BootstrapDecision = z.infer<typeof bootstrapDecisionSchema>;
export type CatalogModelCandidate = z.infer<typeof catalogModelCandidateSchema>;
export type ModelCapacityBudget = z.infer<typeof modelCapacityBudgetSchema>;
