import { isoDateTime, modelEndpointUrl, requiredString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

export const providerTypes = [`openrouter`] as const;
export const providerLifecycleStatuses = [`active`, `deprecated`, `archived`] as const;

export const providerChatConfigSchema = z.object({
  defaultModel: z.string().trim().min(1).nullable().default(null),
  enabledModels: z.array(z.string().trim().min(1)).nullable().default(null),
});

export const providerEmbedderConfigSchema = z.object({
  model: requiredString(`model is required.`),
});

export const providerChatSchema = providerChatConfigSchema.extend({
  provider: uuid(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const providerEmbedderSchema = providerEmbedderConfigSchema.extend({
  provider: uuid(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const providerSchema = z.object({
  id: uuid(),
  owner: uuid(),
  displayName: requiredString(`displayName is required.`),
  providerType: z.enum(providerTypes),
  baseUrl: requiredString(`baseUrl is required.`).pipe(modelEndpointUrl),
  lifecycleStatus: z.enum(providerLifecycleStatuses).default(`active`),
  hasCredential: z.boolean(),
  chat: providerChatSchema.nullable(),
  embedder: providerEmbedderSchema.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const providerMutableSchema = providerSchema.pick({
  displayName: true,
  providerType: true,
  baseUrl: true,
  lifecycleStatus: true,
});

const atLeastOneCapability = (value: { chat: unknown | null; embedder: unknown | null }): boolean => value.chat !== null || value.embedder !== null;

export const providerInsertSchema = providerMutableSchema
  .extend({
    apiKey: requiredString(`apiKey is required.`),
    chat: providerChatConfigSchema.nullable(),
    embedder: providerEmbedderConfigSchema.nullable(),
  })
  .refine(atLeastOneCapability, { message: `At least one provider capability is required.`, path: [`chat`] });

export const providerUpdateSchema = providerMutableSchema.extend({
  apiKey: requiredString(`apiKey is required.`).optional(),
});

export const providerChatUpdateSchema = providerChatConfigSchema;
export const providerEmbedderUpdateSchema = providerEmbedderConfigSchema;

export const providerEmbeddingVerifyResponseSchema = z.object({
  ok: z.literal(true),
  model: z.string(),
  dimensions: z.int().positive(),
});

export const providerEmbeddingPayloadSchema = z.object({
  data: z.array(
    z.object({
      index: z.int().min(0),
      embedding: z.array(z.number().refine(Number.isFinite, `embedding values must be finite.`)),
    }),
  ),
  model: z.string().optional(),
});

export const loopProviderInsertSchema = z.object({
  provider: uuid(),
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
  cooldownUntil: isoDateTime.nullable().optional(),
  healthStatus: z.enum([`unknown`, `healthy`, `failing`]).optional(),
});

export const providerModelSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  contextLength: z.number().int().positive().optional(),
  maxCompletionTokens: z.number().int().positive().optional(),
  modality: z.string().optional(),
  inputModalities: z.array(z.string()).optional(),
  outputModalities: z.array(z.string()).optional(),
  promptPrice: z.string().optional(),
  completionPrice: z.string().optional(),
  requestPrice: z.string().optional(),
  imagePrice: z.string().optional(),
  supportedParameters: z.array(z.string()).optional(),
  knowledgeCutoff: z.string().nullable().optional(),
  reasoningSupported: z.boolean().optional(),
  reasoningEfforts: z.array(z.string()).optional(),
});

export const providerModelListSchema = z.object({
  models: z.array(providerModelSchema),
});

export const providerModelPreviewRequestSchema = z.object({
  providerType: z.enum(providerTypes),
  baseUrl: requiredString(`baseUrl is required.`).pipe(modelEndpointUrl),
  apiKey: requiredString(`apiKey is required.`),
});

export const providerModelValidateRequestSchema = z.object({
  models: z.array(z.string().trim().min(1)).min(1),
});

export const providerModelValidateResultItemSchema = z.object({
  model: z.string(),
  available: z.boolean(),
  reason: z.string().optional(),
});

export const providerModelValidateResponseSchema = z.object({
  results: z.array(providerModelValidateResultItemSchema),
});

export const loopProviderSchema = providerSchema.pick({ displayName: true, providerType: true, baseUrl: true }).extend({
  loop: uuid(),
  provider: uuid(),
  owner: uuid(),
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

export type ProviderInsert = z.infer<typeof providerInsertSchema>;
export type ProviderUpdate = z.infer<typeof providerUpdateSchema>;
export type ProviderChat = z.infer<typeof providerChatSchema>;
export type ProviderChatConfig = z.infer<typeof providerChatConfigSchema>;
export type ProviderChatUpdate = z.infer<typeof providerChatUpdateSchema>;
export type ProviderEmbedder = z.infer<typeof providerEmbedderSchema>;
export type ProviderEmbedderConfig = z.infer<typeof providerEmbedderConfigSchema>;
export type ProviderEmbedderUpdate = z.infer<typeof providerEmbedderUpdateSchema>;
export type ProviderEmbeddingVerifyResponse = z.infer<typeof providerEmbeddingVerifyResponseSchema>;
export type ProviderEmbeddingPayload = z.infer<typeof providerEmbeddingPayloadSchema>;
export type LoopProviderInsert = z.infer<typeof loopProviderInsertSchema>;
export type LoopProviderAdminUpdate = z.infer<typeof loopProviderAdminUpdateSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type LoopProvider = z.infer<typeof loopProviderSchema>;
export type ProviderModel = z.infer<typeof providerModelSchema>;
export type ProviderModelPreviewRequest = z.infer<typeof providerModelPreviewRequestSchema>;
export type ProviderModelValidateRequest = z.infer<typeof providerModelValidateRequestSchema>;
export type ProviderModelValidateResultItem = z.infer<typeof providerModelValidateResultItemSchema>;
export type ProviderModelValidateResponse = z.infer<typeof providerModelValidateResponseSchema>;
