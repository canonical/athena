import { z } from "zod";

export const providerTypes = [`openrouter`] as const;
export const providerLifecycleStatuses = [`active`, `deprecated`, `archived`] as const;

const requiredString = (message: string) => z.preprocess((value) => (typeof value === `string` ? value.trim() || undefined : undefined), z.string(message));

const httpsUrlSchema = z.url(`baseUrl must be a valid URL.`).refine((value) => value.startsWith(`https://`), { message: `baseUrl must use HTTPS.` });

export const providerInsertSchema = z.object({
  displayName: requiredString(`displayName is required.`),
  providerType: z.enum(providerTypes).default(`openrouter`),
  baseUrl: requiredString(`baseUrl is required.`).pipe(httpsUrlSchema),
  model: z.preprocess((value) => (typeof value === `string` ? value.trim() || undefined : undefined), z.string().optional()),
  apiKey: requiredString(`apiKey is required.`),
  lifecycleStatus: z.enum(providerLifecycleStatuses).default(`active`),
});

export const providerUpdateSchema = providerInsertSchema.pick({ displayName: true, providerType: true, baseUrl: true, model: true, lifecycleStatus: true }).extend({
  apiKey: requiredString(`apiKey is required.`).optional(),
});

export const loopProviderInsertSchema = z.object({
  provider: z.uuid(`provider must be a valid UUID.`),
});

export const loopProviderAdminUpdateSchema = z.object({
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

export type ProviderInsert = z.infer<typeof providerInsertSchema>;
export type ProviderUpdate = z.infer<typeof providerUpdateSchema>;
export type LoopProviderInsert = z.infer<typeof loopProviderInsertSchema>;
export type LoopProviderAdminUpdate = z.infer<typeof loopProviderAdminUpdateSchema>;

export type Provider = {
  id: string;
  owner: string;
  displayName: string;
  providerType: (typeof providerTypes)[number];
  baseUrl: string;
  model: string | null;
  lifecycleStatus: (typeof providerLifecycleStatuses)[number];
  hasCredential: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type LoopProvider = {
  loop: string;
  provider: string;
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
  providerType: string;
  baseUrl: string;
  model: string | null;
};
