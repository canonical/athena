import { z } from "zod";

export const runnerTypes = [`github-copilot-cloud`, `juju-vm`] as const;
export const lifecycleStatuses = [`active`, `deprecated`, `archived`] as const;

const requiredString = (message: string) => z.preprocess((value) => (typeof value === `string` ? value.trim() || undefined : undefined), z.string(message));

export const harnessDefinitionInsertSchema = z.object({
  displayName: requiredString(`displayName is required.`),
  runnerType: z.enum(runnerTypes, `runnerType is required.`),
  apiKey: requiredString(`apiKey is required.`),
  lifecycleStatus: z.enum(lifecycleStatuses).default(`active`),
});

export const harnessDefinitionUpdateSchema = harnessDefinitionInsertSchema.pick({ displayName: true, lifecycleStatus: true }).extend({
  apiKey: requiredString(`apiKey is required.`).optional(),
});

export const loopHarnessAssignmentInsertSchema = z.object({
  harnessDefinition: z.uuid(`harnessDefinition must be a valid UUID.`),
});

export const loopHarnessAssignmentAdminUpdateSchema = z.object({
  priority: z.int().min(1).optional(),
  priorityOverride: z.int().min(1).nullable().optional(),
  enabled: z.boolean().optional(),
  timeoutMs: z.int().min(1000).max(600000).optional(),
  maxRetries: z.int().min(0).max(10).optional(),
  selectionWeight: z.number().positive().optional(),
  assignmentOverrides: z.record(z.string(), z.unknown()).optional(),
  remainingCreditPercentage: z.number().min(0).max(100).nullable().optional(),
  remainingCreditValue: z.number().min(0).nullable().optional(),
  cooldownUntil: z.iso.datetime().nullable().optional(),
  healthStatus: z.enum([`unknown`, `healthy`, `failing`]).optional(),
});

export type HarnessDefinitionInsert = z.infer<typeof harnessDefinitionInsertSchema>;
export type HarnessDefinitionUpdate = z.infer<typeof harnessDefinitionUpdateSchema>;
export type LoopHarnessAssignmentInsert = z.infer<typeof loopHarnessAssignmentInsertSchema>;
export type LoopHarnessAssignmentAdminUpdate = z.infer<typeof loopHarnessAssignmentAdminUpdateSchema>;

export type HarnessDefinition = {
  id: string;
  owner: string;
  displayName: string;
  runnerType: (typeof runnerTypes)[number];
  lifecycleStatus: (typeof lifecycleStatuses)[number];
  hasCredential: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type LoopHarnessAssignment = {
  loop: string;
  harnessDefinition: string;
  priority: number;
  priorityOverride: number | null;
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  selectionWeight: number;
  assignmentOverrides: Record<string, unknown>;
  remainingCreditPercentage: number | null;
  remainingCreditValue: number | null;
  cooldownUntil: Date | string | null;
  healthStatus: `unknown` | `healthy` | `failing`;
  lastUsedAt: Date | string | null;
  lastFailedAt: Date | string | null;
  failureCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  displayName: string;
  runnerType: string;
};
