import { httpsUrl, isoDateTime, nullableString, optionalString, requiredString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

export const workgraphTypes = [`jira`] as const;
export const workgraphLifecycleStatuses = [`active`, `deprecated`, `archived`] as const;
export const workgraphSyncStatuses = [`never`, `synchronizing`, `synchronized`, `failed`] as const;

export const workgraphSchema = z.object({
  id: uuid(),
  owner: uuid(),
  name: requiredString(`name is required.`),
  type: z.enum(workgraphTypes),
  baseUrl: requiredString(`baseUrl is required.`).pipe(httpsUrl),
  browseBaseUrl: nullableString,
  projectKey: nullableString,
  email: requiredString(`email is required.`),
  lifecycleStatus: z.enum(workgraphLifecycleStatuses).default(`active`),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const workgraphMutableSchema = workgraphSchema.pick({
  name: true,
  type: true,
  baseUrl: true,
  browseBaseUrl: true,
  projectKey: true,
  email: true,
  lifecycleStatus: true,
});

export const workgraphInsertSchema = workgraphMutableSchema.extend({
  browseBaseUrl: requiredString(`browseBaseUrl is required.`).pipe(httpsUrl),
  apiKey: requiredString(`apiKey is required.`),
});

export const workgraphUpdateSchema = workgraphMutableSchema.extend({
  browseBaseUrl: requiredString(`browseBaseUrl is required.`).pipe(httpsUrl),
  apiKey: optionalString,
});

export const workgraphConnectionTestSchema = z.object({
  type: z.enum(workgraphTypes),
  baseUrl: requiredString(`baseUrl is required.`).pipe(httpsUrl),
  projectKey: nullableString,
  email: requiredString(`email is required.`),
  apiKey: requiredString(`apiKey is required.`),
});

export const loopWorkgraphAssignSchema = z.object({
  loop: uuid(),
  workgraph: uuid(),
});

export const workgraphParamsSchema = z.object({
  workgraph: uuid(`workgraph must be a valid UUID.`),
});

export const loopParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
});

export const loopWorkgraphParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
  workgraph: uuid(`workgraph must be a valid UUID.`),
});

export const loopWorkgraphItemParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
  workgraph: uuid(`workgraph must be a valid UUID.`),
  itemId: uuid(`itemId must be a valid UUID.`),
});

export const workgraphDeleteBodySchema = z.object({
  workgraph: uuid(`workgraph must be a valid UUID.`),
});

export const loopWorkgraphAdminUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  assignmentConfig: z.record(z.string(), z.unknown()).optional(),
});

export const workgraphTypeOptionSchema = z.object({
  id: z.enum(workgraphTypes),
  label: z.string(),
  seedItemTypes: z.array(z.string()),
});

export const workgraphIssueTypeSchema = z.object({
  id: requiredString(`id is required.`),
  name: requiredString(`name is required.`),
  hierarchyLevel: z.number().nullable().optional(),
});

export const loopWorkgraphSchema = workgraphSchema.pick({ name: true, type: true, baseUrl: true, browseBaseUrl: true, projectKey: true }).extend({
  id: uuid(),
  loop: uuid(),
  workgraph: uuid(),
  owner: uuid(),
  enabled: z.boolean(),
  assignmentConfig: z.record(z.string(), z.unknown()),
  lastSyncedAt: isoDateTime.nullable(),
  lastSyncStatus: z.enum(workgraphSyncStatuses),
  lastSyncError: nullableString,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const loopWorkgraphItemSchema = z.object({
  id: uuid(),
  loopWorkgraph: uuid(),
  loop: uuid(),
  workgraph: uuid(),
  itemKey: requiredString(`itemKey is required.`),
  itemId: requiredString(`itemId is required.`),
  parentKey: nullableString,
  title: requiredString(`title is required.`),
  itemType: requiredString(`itemType is required.`),
  status: nullableString,
  webUrl: nullableString,
  payload: z.record(z.string(), z.unknown()),
  syncedAt: isoDateTime,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const loopWorkgraphSyncResultSchema = z.object({
  ok: z.literal(true),
  state: z.enum(workgraphSyncStatuses),
  started: z.boolean(),
  message: z.string(),
});

export const loopWorkgraphStartItemResultSchema = z.object({
  ok: z.literal(true),
  itemKey: z.string(),
  label: z.string(),
  message: z.string(),
});

export type WorkgraphInsert = z.infer<typeof workgraphInsertSchema>;
export type WorkgraphUpdate = z.infer<typeof workgraphUpdateSchema>;
export type WorkgraphConnectionTest = z.infer<typeof workgraphConnectionTestSchema>;
export type LoopWorkgraphAssign = z.infer<typeof loopWorkgraphAssignSchema>;
export type LoopWorkgraphAdminUpdate = z.infer<typeof loopWorkgraphAdminUpdateSchema>;
export type Workgraph = z.infer<typeof workgraphSchema>;
export type LoopWorkgraph = z.infer<typeof loopWorkgraphSchema>;
export type LoopWorkgraphItem = z.infer<typeof loopWorkgraphItemSchema>;
export type LoopWorkgraphSyncResult = z.infer<typeof loopWorkgraphSyncResultSchema>;
export type LoopWorkgraphStartItemResult = z.infer<typeof loopWorkgraphStartItemResultSchema>;
export type WorkgraphTypeOption = z.infer<typeof workgraphTypeOptionSchema>;
export type WorkgraphIssueType = z.infer<typeof workgraphIssueTypeSchema>;
