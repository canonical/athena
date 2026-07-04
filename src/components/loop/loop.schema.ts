import type { NotificationSeverity } from "@canonical/react-components";
import { z } from "zod";
import type { PersonaListState } from "../persona/persona.query.js";

const requiredString = (message: string) => z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : undefined), z.string(message));

export const loopSelectionAlgorithms = [`round-robin`, `highest-credit-percentage`, `highest-credit-absolute`, `weighted-round-robin`, `least-recently-used`, `priority-failover`, `health-aware-cooldown`] as const;

export const loopInsertSchema = z.object({
  name: requiredString("name is required."),
  description: z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : undefined), z.string().optional()),
});

export const loopUpdateSchema = loopInsertSchema;

export const providerSelectionPolicyUpdateSchema = z.object({
  openRouterSelectionAlgorithm: z.enum(loopSelectionAlgorithms).optional(),
  copilotSelectionAlgorithm: z.enum(loopSelectionAlgorithms).optional(),
  selectionCooldownWindowMs: z.int().min(1000).max(86_400_000).optional(),
});

export type Loop = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type ProviderSelectionPolicy = {
  loop: string;
  openRouterSelectionAlgorithm: (typeof loopSelectionAlgorithms)[number];
  copilotSelectionAlgorithm: (typeof loopSelectionAlgorithms)[number];
  openRouterSelectionCursor: number;
  copilotSelectionCursor: number;
  selectionCooldownWindowMs: number;
  updatedAt: Date | string;
};

export type LoopInsert = z.infer<typeof loopInsertSchema>;

export type LoopUpdate = z.infer<typeof loopUpdateSchema>;

export type ProviderSelectionPolicyUpdate = z.infer<typeof providerSelectionPolicyUpdateSchema>;

export type LoopUser = {
  loop: string;
  user: string;
  isAdmin: boolean;
  createdAt: Date | string;
};

export type Feedback = {
  severity: (typeof NotificationSeverity)[keyof typeof NotificationSeverity];
  title: string;
  message: string;
};

export type Tab = "details" | "personas" | "providers";

export type LoopProps = {
  loopId: string;
  tab: Tab;
  editor?: `create` | `edit` | `clone`;
  personaId?: string;
};

export type LoopDetailsProps = {
  loopId: string;
  loopName: string;
  loopDescription: string;
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
