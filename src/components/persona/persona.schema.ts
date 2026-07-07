import type { NotificationSeverity } from "@canonical/react-components";
import { z } from "zod";

export const personaLifecycleStatuses = [`active`, `deprecated`, `archived`] as const;
export type PersonaLifecycleStatus = (typeof personaLifecycleStatuses)[number];

const requiredString = (message: string) => z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : undefined), z.string(message));

export const personaInsertSchema = z.object({
  displayName: requiredString(`displayName is required.`),
  role: z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : undefined), z.string().optional()),
  personality: requiredString(`personality is required.`),
  lifecycleStatus: z.enum(personaLifecycleStatuses).default(`active`),
});

export const personaUpdateSchema = z.object({
  displayName: requiredString(`displayName is required.`),
  role: z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : undefined), z.string().optional()),
  personality: requiredString(`personality is required.`),
  lifecycleStatus: z.enum(personaLifecycleStatuses),
});

export type Persona = {
  id: string;
  displayName: string;
  role: string | null;
  personality: string;
  isRouting: boolean;
  isDefault: boolean;
  owner: string | null;
  lifecycleStatus: PersonaLifecycleStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type PersonaInsert = z.infer<typeof personaInsertSchema>;
export type PersonaUpdate = z.infer<typeof personaUpdateSchema>;

export type Feedback = {
  severity: (typeof NotificationSeverity)[keyof typeof NotificationSeverity];
  title: string;
  message: string;
};

export type FormState = {
  displayName: string;
  role: string;
  personality: string;
  lifecycleStatus: (typeof personaLifecycleStatuses)[number];
};

export type PersonaDetailProps = {
  personaId: string;
};

export type PersonaEditorProps = {
  loopId?: string;
  editingPersona: Persona | null;
  cloneSource?: Persona | null;
  catalogTemplates?: Persona[];
  onSuccess: (message: string) => void;
  onCancel?: () => void;
};
