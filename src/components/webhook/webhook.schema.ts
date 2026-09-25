import { isoDateTime, requiredString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

export const webhookTypes = [`workgraph`] as const;
export const webhookSecurityModes = [`header`] as const;
export const webhookItemStatuses = [`new`, `processing`, `done`] as const;

export const loopWorkgraphWebhookSchema = z.object({
  id: uuid(),
  label: requiredString(`label is required.`),
  receiverId: requiredString(`receiverId is required.`),
  type: z.enum(webhookTypes),
  loopWorkgraph: uuid(),
  authHeaderName: requiredString(`authHeaderName is required.`),
  securityMode: z.enum(webhookSecurityModes),
  securityConfig: z.record(z.string(), z.unknown()),
  active: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const loopWorkgraphWebhookCreateSchema = z.object({
  label: requiredString(`label is required.`),
  authHeaderName: requiredString(`authHeaderName is required.`),
});

export const loopWorkgraphWebhookUpdateSchema = z.object({
  label: requiredString(`label is required.`).optional(),
  authHeaderName: requiredString(`authHeaderName is required.`).optional(),
  active: z.boolean().optional(),
});

export const loopWorkgraphWebhookCreateResultSchema = loopWorkgraphWebhookSchema.extend({
  secret: requiredString(`secret is required.`),
});

export const webhookItemSchema = z.object({
  id: uuid(),
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(webhookItemStatuses),
  retryCount: z.number().int().nonnegative(),
});

export type LoopWorkgraphWebhook = z.infer<typeof loopWorkgraphWebhookSchema>;
export type LoopWorkgraphWebhookCreate = z.infer<typeof loopWorkgraphWebhookCreateSchema>;
export type LoopWorkgraphWebhookUpdate = z.infer<typeof loopWorkgraphWebhookUpdateSchema>;
export type LoopWorkgraphWebhookCreateResult = z.infer<typeof loopWorkgraphWebhookCreateResultSchema>;
export type WebhookItem = z.infer<typeof webhookItemSchema>;
