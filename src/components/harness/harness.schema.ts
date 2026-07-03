import { z } from "zod";

export const runnerTypes = [`github-copilot-cloud`, `juju-vm`] as const;
export const lifecycleStatuses = [`active`, `deprecated`, `archived`] as const;

const requiredString = (message: string) => z.preprocess((value) => (typeof value === `string` ? value.trim() || undefined : undefined), z.string(message));

export const harnessInsertSchema = z.object({
  displayName: requiredString(`displayName is required.`),
  runnerType: z.enum(runnerTypes, `runnerType is required.`),
  apiKey: requiredString(`apiKey is required.`),
  lifecycleStatus: z.enum(lifecycleStatuses).default(`active`),
});

export const harnessUpdateSchema = harnessInsertSchema.pick({ displayName: true, lifecycleStatus: true }).extend({
  apiKey: requiredString(`apiKey is required.`).optional(),
});

export const loopHarnessInsertSchema = z.object({
  harness: z.uuid(`harness must be a valid UUID.`),
});

export const loopHarnessAdminUpdateSchema = z.object({
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

export type HarnessInsert = z.infer<typeof harnessInsertSchema>;
export type HarnessUpdate = z.infer<typeof harnessUpdateSchema>;
export type LoopHarnessInsert = z.infer<typeof loopHarnessInsertSchema>;
export type LoopHarnessAdminUpdate = z.infer<typeof loopHarnessAdminUpdateSchema>;

export type Harness = {
  id: string;
  owner: string;
  displayName: string;
  runnerType: (typeof runnerTypes)[number];
  lifecycleStatus: (typeof lifecycleStatuses)[number];
  hasCredential: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type LoopHarness = {
  loop: string;
  harness: string;
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
