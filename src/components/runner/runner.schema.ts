import { isoDateTime, requiredString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

export const runnerTypes = [`github-copilot-cloud`, `juju-vm`] as const;
export const lifecycleStatuses = [`active`, `deprecated`, `archived`] as const;

export const runnerSchema = z.object({
  id: uuid(),
  owner: uuid(),
  displayName: requiredString(`displayName is required.`),
  runnerType: z.enum(runnerTypes),
  lifecycleStatus: z.enum(lifecycleStatuses).default(`active`),
  hasCredential: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const runnerMutableSchema = runnerSchema.pick({
  displayName: true,
  runnerType: true,
  lifecycleStatus: true,
});

export const runnerInsertSchema = runnerMutableSchema.extend({
  apiKey: requiredString(`apiKey is required.`),
});

export const runnerUpdateSchema = runnerInsertSchema.pick({ displayName: true, lifecycleStatus: true }).extend({
  apiKey: requiredString(`apiKey is required.`).optional(),
});

export const loopRunnerInsertSchema = z.object({
  runner: uuid(),
});

export const loopRunnerAdminUpdateSchema = z.object({
  priority: z.int().min(1).optional(),
  priorityOverride: z.int().min(1).nullable().optional(),
  enabled: z.boolean().optional(),
  timeoutMs: z.int().min(1000).max(600000).optional(),
  maxRetries: z.int().min(0).max(10).optional(),
  selectionWeight: z.number().positive().optional(),
  assignmentOverrides: z.record(z.string(), z.unknown()).optional(),
  remainingCreditPercentage: z.number().min(0).max(100).nullable().optional(),
  remainingCreditValue: z.number().min(0).nullable().optional(),
  cooldownUntil: isoDateTime.nullable().optional(),
  healthStatus: z.enum([`unknown`, `healthy`, `failing`]).optional(),
});

export const loopRunnerSchema = runnerSchema.pick({ displayName: true, runnerType: true }).extend({
  loop: uuid(),
  runner: uuid(),
  priority: z.number(),
  priorityOverride: z.number().nullable(),
  enabled: z.boolean(),
  timeoutMs: z.number(),
  maxRetries: z.number(),
  selectionWeight: z.number(),
  assignmentOverrides: z.record(z.string(), z.unknown()),
  remainingCreditPercentage: z.number().nullable(),
  remainingCreditValue: z.number().nullable(),
  cooldownUntil: isoDateTime.nullable(),
  healthStatus: z.enum([`unknown`, `healthy`, `failing`]),
  lastUsedAt: isoDateTime.nullable(),
  lastFailedAt: isoDateTime.nullable(),
  failureCount: z.number(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export type RunnerInsert = z.infer<typeof runnerInsertSchema>;
export type RunnerUpdate = z.infer<typeof runnerUpdateSchema>;
export type LoopRunnerInsert = z.infer<typeof loopRunnerInsertSchema>;
export type LoopRunnerAdminUpdate = z.infer<typeof loopRunnerAdminUpdateSchema>;
export type Runner = z.infer<typeof runnerSchema>;
export type LoopRunner = z.infer<typeof loopRunnerSchema>;
