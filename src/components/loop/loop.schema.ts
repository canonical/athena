import type { NotificationSeverity } from "@canonical/react-components";
import { isoDateTime, nullableString, requiredString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";
import type { PersonaListState } from "../persona/persona.query.js";

export const loopSelectionAlgorithms = [`round-robin`, `highest-credit-percentage`, `highest-credit-absolute`, `weighted-round-robin`, `least-recently-used`, `priority-failover`, `health-aware-cooldown`] as const;

export const loopSchema = z.object({
  id: uuid(),
  name: requiredString("name is required."),
  description: nullableString,
  iterationCostLimitUsd: z.number().nonnegative().nullable(),
  currentUserIsAdmin: z.boolean().optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export type Loop = z.infer<typeof loopSchema>;

export const loopInsertSchema = loopSchema.omit({ id: true, currentUserIsAdmin: true, createdAt: true, updatedAt: true }).extend({
  description: nullableString,
  iterationCostLimitUsd: z.number().nonnegative().nullable().optional(),
});

export const loopUpdateSchema = loopInsertSchema.extend({
  iterationCostLimitUsd: z.number().nonnegative().nullable(),
});

export const providerSelectionPolicyUpdateSchema = z.object({
  providerSelectionAlgorithm: z.enum(loopSelectionAlgorithms).optional(),
  runnerSelectionAlgorithm: z.enum(loopSelectionAlgorithms).optional(),
});

export const providerSelectionPolicySchema = z.object({
  loop: uuid(),
  providerSelectionAlgorithm: z.enum(loopSelectionAlgorithms),
  providerSelectionCursor: z.int(),
  runnerSelectionAlgorithm: z.enum(loopSelectionAlgorithms),
  runnerSelectionCursor: z.int(),
  updatedAt: isoDateTime,
});

export type ProviderSelectionPolicy = z.infer<typeof providerSelectionPolicySchema>;

export const loopToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  enabled: z.boolean(),
  requiresApproval: z.boolean(),
});

export const loopToolsSchema = z.object({
  loop: uuid(),
  tools: z.array(loopToolSchema),
});

export const loopToolsUpdateRequestSchema = z.object({
  enabledToolNames: z.array(z.string().min(1)),
});

export const loopMemberSchema = z.object({
  user: z.string().min(1),
  name: z.string(),
  picture: z.string(),
  isAdmin: z.boolean(),
  createdAt: isoDateTime,
});

export const loopInviteSchema = z.object({
  id: uuid(),
  loop: uuid(),
  loopName: requiredString("loopName is required."),
  invitedEmail: z.string().check(z.email()),
  invitedBy: z.string().min(1),
  invitedByName: z.string(),
  acceptedBy: z.string().nullable(),
  revokedBy: z.string().nullable(),
  acceptedAt: isoDateTime.nullable(),
  revokedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const loopMembershipSchema = z.object({
  loop: uuid(),
  currentUser: z.string().min(1),
  currentUserIsAdmin: z.boolean(),
  members: z.array(loopMemberSchema),
  pendingInvites: z.array(loopInviteSchema),
});

export const loopInviteCreateSchema = z.object({
  email: z.string().trim().toLowerCase().check(z.email()),
});

export const loopUserAdminUpdateSchema = z.object({
  user: z.string().trim().toLowerCase().check(z.email()),
  isAdmin: z.boolean(),
});

export type LoopTool = z.infer<typeof loopToolSchema>;
export type LoopTools = z.infer<typeof loopToolsSchema>;
export type LoopToolsUpdateRequest = z.infer<typeof loopToolsUpdateRequestSchema>;
export type LoopMember = z.infer<typeof loopMemberSchema>;
export type LoopInvite = z.infer<typeof loopInviteSchema>;
export type LoopMembership = z.infer<typeof loopMembershipSchema>;
export type LoopInviteCreate = z.infer<typeof loopInviteCreateSchema>;
export type LoopUserAdminUpdate = z.infer<typeof loopUserAdminUpdateSchema>;

export const loopReadinessBlockerCodes = [`NO_ACTIVE_ROUTING_PERSONA`, `MULTIPLE_ACTIVE_ROUTING_PERSONAS`, `NO_ACTIVE_EXECUTION_PERSONA`, `NO_ACTIVE_CHAT_PROVIDER`, `NO_ACTIVE_RUNNER`, `NO_ACTIVE_WORKGRAPH`] as const;

export const loopReadinessBlockerSchema = z.object({
  code: z.enum(loopReadinessBlockerCodes),
  message: z.string(),
});

export const loopReadinessSchema = z.object({
  loop: uuid(),
  blocked: z.boolean(),
  blockers: z.array(loopReadinessBlockerSchema),
});

export type LoopReadiness = z.infer<typeof loopReadinessSchema>;
export type LoopReadinessBlocker = z.infer<typeof loopReadinessBlockerSchema>;

export type LoopInsert = z.infer<typeof loopInsertSchema>;

export type LoopUpdate = z.infer<typeof loopUpdateSchema>;

export type ProviderSelectionPolicyUpdate = z.infer<typeof providerSelectionPolicyUpdateSchema>;

export const loopUserSchema = z.object({
  loop: uuid(),
  user: z.string(),
  isAdmin: z.boolean(),
  createdAt: isoDateTime,
});

export type LoopUser = z.infer<typeof loopUserSchema>;

export type Feedback = {
  severity: (typeof NotificationSeverity)[keyof typeof NotificationSeverity];
  title: string;
  message: string;
};

export const loopTabs = [`tasks`, `details`, `memory`, `tools`, `members`, `personas`, `providers`, `runners`, `workgraphs`, `repositories`] as const;
export const loopTabSchema = z.enum(loopTabs);

export type Tab = z.infer<typeof loopTabSchema>;

export type LoopProps = {
  loopId: string;
  tab: Tab;
  editor?: `create` | `edit` | `clone`;
  personaId?: string;
  workgraphViewWorkgraphId?: string;
  workgraphConfigTab?: `jql` | `labels` | `item-type-playbooks` | `webhook-definitions` | `synced-items`;
};

export type LoopDetailsProps = {
  loopId: string;
  loopName: string;
  loopDescription: string;
  loopIterationCostLimitUsd: number | null;
  onFeedback: (feedback: Feedback | null) => void;
  onSaved: () => void;
};

export type LoopPersonasProps = {
  loopId: string;
  editor?: `create` | `edit` | `clone`;
  personaId?: string;
  personaListState: PersonaListState;
  reloadPersonaList: () => void;
  onFeedback: (feedback: Feedback | null) => void;
};

export type LoopProvidersProps = {
  loopId: string;
  onFeedback: (feedback: Feedback | null) => void;
};

export type LoopToolsProps = {
  loopId: string;
  onFeedback: (feedback: Feedback | null) => void;
};

export type LoopMembersProps = {
  loopId: string;
  onFeedback: (feedback: Feedback | null) => void;
};

export type LoopRunnersProps = {
  loopId: string;
  onFeedback: (feedback: Feedback | null) => void;
};

export type LoopWorkgraphsProps = {
  loopId: string;
  onFeedback: (feedback: Feedback | null) => void;
  workgraphViewWorkgraphId?: string;
  workgraphConfigTab?: `jql` | `labels` | `item-type-playbooks` | `webhook-definitions` | `synced-items`;
};

export type LoopRepositoriesProps = {
  loopId: string;
  onFeedback: (feedback: Feedback | null) => void;
};
