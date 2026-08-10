import type { NotificationSeverity } from "@canonical/react-components";
import { isoDateTime, nullableString, requiredString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

export const personaLifecycleStatuses = [`active`, `deprecated`, `archived`] as const;
export type PersonaLifecycleStatus = (typeof personaLifecycleStatuses)[number];

export const personaSchema = z.object({
  id: uuid(),
  displayName: requiredString(`displayName is required.`),
  role: nullableString,
  personality: requiredString(`personality is required.`),
  isRouting: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  owner: nullableString,
  lifecycleStatus: z.enum(personaLifecycleStatuses).default(`active`),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export type Persona = z.infer<typeof personaSchema>;
export type PersonaId = Persona["id"];

export const personaWritableSchema = personaSchema.omit({
  id: true,
  isRouting: true,
  isDefault: true,
  owner: true,
  createdAt: true,
  updatedAt: true,
});

export type PersonaWritable = z.infer<typeof personaWritableSchema>;

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
  editingPersona: Persona | null;
  cloneSource?: Persona | null;
  catalogTemplates?: Persona[];
  onSuccess: (message: string) => void;
  onCancel?: () => void;
  onDelete?: (persona: Persona) => Promise<void>;
  isDeleting?: boolean;
};
