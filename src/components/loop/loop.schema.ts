import type { NotificationSeverity } from "@canonical/react-components";
import { z } from "zod";

const requiredString = (message: string) => z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : undefined), z.string(message));

export const loopInsertSchema = z.object({
  name: requiredString("name is required."),
  description: z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : undefined), z.string().optional()),
});

export const loopUpdateSchema = loopInsertSchema;

export type Loop = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type LoopInsert = z.infer<typeof loopInsertSchema>;

export type LoopUpdate = z.infer<typeof loopUpdateSchema>;

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

export type Tab = "details" | "personas";

export type LoopProps = {
  loopId: string;
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
  onFeedback: (feedback: Feedback | null) => void;
  onRoutingStatusChange: (activeRoutingCount: number) => void;
};
