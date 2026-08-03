import { httpsUrl, isoDateTime, nullableString, optionalString, requiredString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

export const workgraphTypes = [`jira`] as const;
export const workgraphLifecycleStatuses = [`active`, `deprecated`, `archived`] as const;
export const workgraphSyncStatuses = [`never`, `ok`, `failed`] as const;

export const workgraphSchema = z.object({
  id: uuid(),
  owner: uuid(),
  name: requiredString(`name is required.`),
  type: z.enum(workgraphTypes),
  baseUrl: requiredString(`baseUrl is required.`).pipe(httpsUrl),
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
  projectKey: true,
  email: true,
  lifecycleStatus: true,
});

export const workgraphInsertSchema = workgraphMutableSchema.extend({
  apiKey: requiredString(`apiKey is required.`),
});

export const workgraphUpdateSchema = workgraphMutableSchema.extend({
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

export const workgraphSeedItemSchema = requiredString(`seed item id is required.`);

export const loopWorkgraphAdminUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  seedItems: z.array(workgraphSeedItemSchema).optional(),
  hierarchyRules: z.record(z.string(), z.unknown()).optional(),
  assignmentOverrides: z.record(z.string(), z.unknown()).optional(),
});

export const workgraphTypeOptionSchema = z.object({
  id: z.enum(workgraphTypes),
  label: z.string(),
  seedItemTypes: z.array(z.string()),
});

export const loopWorkgraphSchema = workgraphSchema.pick({ name: true, type: true, baseUrl: true, projectKey: true }).extend({
  loop: uuid(),
  workgraph: uuid(),
  owner: uuid(),
  enabled: z.boolean(),
  seedItems: z.array(workgraphSeedItemSchema),
  hierarchyRules: z.record(z.string(), z.unknown()),
  assignmentOverrides: z.record(z.string(), z.unknown()),
  lastSyncedAt: isoDateTime.nullable(),
  lastSyncStatus: z.enum(workgraphSyncStatuses),
  lastSyncError: nullableString,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export type WorkgraphInsert = z.infer<typeof workgraphInsertSchema>;
export type WorkgraphUpdate = z.infer<typeof workgraphUpdateSchema>;
export type WorkgraphConnectionTest = z.infer<typeof workgraphConnectionTestSchema>;
export type LoopWorkgraphAssign = z.infer<typeof loopWorkgraphAssignSchema>;
export type LoopWorkgraphAdminUpdate = z.infer<typeof loopWorkgraphAdminUpdateSchema>;
export type Workgraph = z.infer<typeof workgraphSchema>;
export type LoopWorkgraph = z.infer<typeof loopWorkgraphSchema>;
export type WorkgraphTypeOption = z.infer<typeof workgraphTypeOptionSchema>;
export type WorkgraphSeedItem = z.infer<typeof workgraphSeedItemSchema>;
