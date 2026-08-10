import { httpsUrl, isoDateTime, optionalString, requiredString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

export const repositoryTypes = [`github`] as const;
export const repositoryLifecycleStatuses = [`active`, `deprecated`, `archived`] as const;

export const repositorySchema = z.object({
  id: uuid(),
  owner: uuid(),
  displayName: requiredString(`displayName is required.`),
  repositoryType: z.enum(repositoryTypes),
  apiBaseUrl: requiredString(`apiBaseUrl is required.`).pipe(httpsUrl),
  repositoryOwner: requiredString(`repositoryOwner is required.`),
  repositoryName: requiredString(`repositoryName is required.`),
  defaultBranch: optionalString,
  lifecycleStatus: z.enum(repositoryLifecycleStatuses).default(`active`),
  hasCredential: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const repositoryMutableSchema = repositorySchema.pick({
  displayName: true,
  repositoryType: true,
  apiBaseUrl: true,
  repositoryOwner: true,
  repositoryName: true,
  defaultBranch: true,
  lifecycleStatus: true,
});

export const repositoryInsertSchema = repositoryMutableSchema.extend({
  apiKey: requiredString(`apiKey is required.`),
});

export const repositoryUpdateSchema = repositoryMutableSchema.extend({
  apiKey: requiredString(`apiKey is required.`).optional(),
});

export const repositoryConnectionTestSchema = z.object({
  repositoryType: z.enum(repositoryTypes),
  apiBaseUrl: requiredString(`apiBaseUrl is required.`).pipe(httpsUrl),
  repositoryOwner: requiredString(`repositoryOwner is required.`),
  repositoryName: requiredString(`repositoryName is required.`),
  apiKey: requiredString(`apiKey is required.`),
});

export const loopRepositoryAssignSchema = z.object({
  loop: uuid(),
  repository: uuid(),
});

export const loopRepositorySchema = repositorySchema.pick({ displayName: true, repositoryType: true, apiBaseUrl: true, repositoryOwner: true, repositoryName: true, defaultBranch: true, lifecycleStatus: true }).extend({
  loop: uuid(),
  repository: uuid(),
  owner: uuid(),
  enabled: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export type Repository = z.infer<typeof repositorySchema>;
export type RepositoryInsert = z.infer<typeof repositoryInsertSchema>;
export type RepositoryUpdate = z.infer<typeof repositoryUpdateSchema>;
export type RepositoryConnectionTest = z.infer<typeof repositoryConnectionTestSchema>;
export type LoopRepositoryAssign = z.infer<typeof loopRepositoryAssignSchema>;
export type LoopRepository = z.infer<typeof loopRepositorySchema>;
