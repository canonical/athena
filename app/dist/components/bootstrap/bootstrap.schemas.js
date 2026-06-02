import { z } from "zod";
export const bootstrapDecisionSchema = z.object({
    model: z.string(),
    reason: z.string(),
});
export const bootstrapDecisionResponseFormat = {
    type: `object`,
    properties: {
        model: {
            type: `string`,
        },
        reason: {
            type: `string`,
        },
    },
    required: [`model`, `reason`],
    additionalProperties: false,
};
export const catalogModelCandidateSchema = z.object({
    model: z.string(),
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
//# sourceMappingURL=bootstrap.schemas.js.map