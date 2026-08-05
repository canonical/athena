import { z } from "zod";

export const authenticationSearchSchema = z.object({
  returnTo: z.string().optional(),
});

export const loopDetailSearchSchema = z.object({
  tab: z.enum([`dashboard`, `details`, `personas`, `providers`, `runners`, `workgraphs`, `repositories`]).optional(),
  create: z.literal(true).optional(),
  edit: z.string().optional(),
  clone: z.literal(true).optional(),
  workgraphView: z.string().optional(),
  workgraphConfigTab: z.enum([`jql`, `labels`, `item-type-playbooks`, `webhook-definitions`, `synced-items`]).optional(),
});

export const loopListSearchSchema = z.object({
  create: z.literal(true).optional(),
  edit: z.string().optional(),
});

export const personaListSearchSchema = z.object({
  tab: z.enum([`my-personas`, `catalog`]).optional(),
  create: z.literal(true).optional(),
  edit: z.string().optional(),
  clone: z.literal(true).optional(),
});

export const providerListSearchSchema = z.object({
  create: z.literal(true).optional(),
  edit: z.string().optional(),
});

export const providerDetailSearchSchema = z.object({
  tab: z.enum([`details`, `settings`]).optional(),
});

export const runnerListSearchSchema = z.object({
  create: z.literal(true).optional(),
  edit: z.string().optional(),
});

export const connectionListSearchSchema = z.object({
  tab: z.enum([`workgraphs`, `repositories`]).optional(),
  create: z.literal(true).optional(),
  edit: z.string().optional(),
});

export const workgraphListSearchSchema = z.object({
  create: z.literal(true).optional(),
  edit: z.string().optional(),
});

export type AuthenticationSearch = z.infer<typeof authenticationSearchSchema>;
export type LoopDetailSearch = z.infer<typeof loopDetailSearchSchema>;
export type LoopListSearch = z.infer<typeof loopListSearchSchema>;
export type PersonaListSearch = z.infer<typeof personaListSearchSchema>;
export type ProviderListSearch = z.infer<typeof providerListSearchSchema>;
export type ProviderDetailSearch = z.infer<typeof providerDetailSearchSchema>;
export type RunnerListSearch = z.infer<typeof runnerListSearchSchema>;
export type ConnectionListSearch = z.infer<typeof connectionListSearchSchema>;
export type WorkgraphListSearch = z.infer<typeof workgraphListSearchSchema>;
