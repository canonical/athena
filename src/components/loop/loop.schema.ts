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
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export type Loop = z.infer<typeof loopSchema>;

export const loopInsertSchema = loopSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
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

export type LoopTool = z.infer<typeof loopToolSchema>;
export type LoopTools = z.infer<typeof loopToolsSchema>;
export type LoopToolsUpdateRequest = z.infer<typeof loopToolsUpdateRequestSchema>;

export const loopReadinessBlockerCodes = [
  `NO_ACTIVE_ROUTING_PERSONA`,
  `MULTIPLE_ACTIVE_ROUTING_PERSONAS`,
  `NO_ACTIVE_EXECUTION_PERSONA`,
  `NO_ACTIVE_PROVIDER`,
  `NO_PROVIDER_MODEL_CONFIGURATION`,
  `PROVIDER_MODEL_CONFIGURATION_INCOMPLETE`,
  `NO_ACTIVE_RUNNER`,
  `NO_ACTIVE_WORKGRAPH`,
] as const;

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

export const loopTabs = [`tasks`, `details`, `tools`, `personas`, `providers`, `runners`, `workgraphs`, `repositories`] as const;
export const loopTabSchema = z.enum(loopTabs);

export type Tab = z.infer<typeof loopTabSchema>;

export type LoopProps = {
  loopId: string;
  tab: Tab;
  taskId?: string;
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
