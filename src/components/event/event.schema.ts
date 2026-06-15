import type { Loop } from "@components/loop/loop.schema.js";
import { z } from "zod";

export const athenaPersonaId = `athena` as const;
export const engineeringManagerPersonaId = `em.diana` as const;
export const personaIds = [engineeringManagerPersonaId, `pm.alice`, `pm.beatrice`, `ic.clara`, `cr.elena`, `ux.fiona`, `qa.grace`] as const;
export const executionPersonaIds = personaIds.filter((persona) => persona !== engineeringManagerPersonaId);
export const loopEventStatuses = [`created`, `routed`, `completed`, `blocked`] as const;

export type AthenaPersonaId = typeof athenaPersonaId;
export type PersonaId = (typeof personaIds)[number];
export type ExecutionPersonaId = (typeof executionPersonaIds)[number];
export type LoopEventStatus = (typeof loopEventStatuses)[number];
export type EventPayload = Record<string, unknown>;
export type EventApprovals = unknown[];
export type EmittingPersonaId = AthenaPersonaId | PersonaId;

const normalizedString = z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : undefined), z.string().optional());

const requiredString = (message: string) => z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : undefined), z.string(message));

export const createEventRequestSchema = z.object({
  loop: z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : undefined), z.string(`loop is required.`).uuid(`loop must be a valid UUID.`)),
  sourceType: requiredString(`sourceType is required.`),
  requestedOutcome: requiredString(`requestedOutcome is required.`),
  sourceRef: normalizedString,
  assignedPersona: z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : undefined), z.enum(personaIds).optional()),
  approvals: z.array(z.unknown()).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type Event = {
  id: string;
  loop: string;
  sourceType: string;
  sourceRef: string | null;
  status: string;
  assignee: string | null;
  requestedOutcome: string | null;
  emittedByPersona: string | null;
  blocker: string | null;
  approvals: EventApprovals;
  payload: EventPayload;
  emittedAt: Date | string;
  completedAt: Date | string | null;
  updatedAt: Date | string;
};

export type CreateEventRequest = {
  loop: string;
  sourceType: string;
  sourceRef?: string;
  assignedPersona?: string;
  requestedOutcome: string;
  approvals?: EventApprovals;
  payload?: EventPayload;
};

export type ValidatedCreateEventRequest = {
  loop: string;
  sourceType: string;
  sourceRef?: string;
  assignedPersona?: PersonaId;
  requestedOutcome: string;
  approvals: EventApprovals;
  payload: EventPayload;
};

export type EventSourceContext = {
  request: ValidatedCreateEventRequest;
  sourcePayload: EventPayload;
  sourceRef?: string;
};

export type HandoffBuildInput = {
  approvals: EventApprovals;
  blocker?: string;
  context: string;
  nextExpectedAction: string;
  nextOwningPersona: string | null;
  status: LoopEventStatus;
};

export type EventPayloadBuildInput = HandoffBuildInput & {
  note: string;
  request: ValidatedCreateEventRequest;
  sourcePayload: EventPayload;
};

export type CreateEventResponse = {
  loop: Loop;
  events: Event[];
};

export type LoopPersonaRoutedResult = {
  status: `routed`;
  assignee: PersonaId;
  note: string;
};

export type LoopPersonaCompletedResult = {
  status: `completed`;
  note: string;
};

export type LoopPersonaBlockedResult = {
  status: `blocked`;
  blocker: string;
  note: string;
};

export type LoopPersonaResult = LoopPersonaRoutedResult | LoopPersonaCompletedResult | LoopPersonaBlockedResult;

export type LoopPersonaHandler = {
  persona: PersonaId;
  handle: (event: Event) => LoopPersonaResult;
};

export type EventInsert = {
  loop: string;
  sourceType: string;
  sourceRef?: string;
  status: LoopEventStatus;
  assignee?: string;
  requestedOutcome: string;
  emittedByPersona: EmittingPersonaId;
  blocker?: string;
  approvals: EventApprovals;
  payload: EventPayload;
  completedAt?: Date;
};

export type RoutedEventCreation = EventSourceContext & {
  assignee: PersonaId;
  emittedByPersona: EmittingPersonaId;
  note: string;
};

export type ConcludedEventCreation = EventSourceContext & {
  assignee: PersonaId;
  note: string;
};

export type BlockedEventCreation = ConcludedEventCreation & {
  blocker: string;
};

export type EventFollowUpRequest = EventSourceContext & {
  currentEvent: Event;
  result: LoopPersonaResult;
};
