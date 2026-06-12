import type { Loop } from "@components/loop/loop.schema.js";

export const athenaPersonaId = `athena` as const;
export const engineeringManagerPersonaId = `em.diana` as const;
export const personaIds = [engineeringManagerPersonaId, `pm.alice`, `pm.beatrice`, `ic.clara`, `cr.elena`, `ux.fiona`, `qa.grace`] as const;
export const executionPersonaIds = personaIds.filter((persona) => persona !== engineeringManagerPersonaId);
export const loopSourceTypes = [`github`, `jira`, `human-chat`] as const;
export const loopEventStatuses = [`created`, `routed`, `completed`, `blocked`] as const;

export type AthenaPersonaId = typeof athenaPersonaId;
export type PersonaId = (typeof personaIds)[number];
export type ExecutionPersonaId = (typeof executionPersonaIds)[number];
export type LoopSourceType = (typeof loopSourceTypes)[number];
export type LoopEventStatus = (typeof loopEventStatuses)[number];
export type EventPayload = Record<string, unknown>;
export type EventApprovals = unknown[];

export type Event = {
  id: string;
  loop: string;
  sourceType: string;
  sourceRef: string | null;
  status: string;
  assignee: string | null;
  workItemUrl: string | null;
  topLevelWorkItemUrl: string | null;
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
  workItemUrl: string;
  topLevelWorkItemUrl?: string;
  requestedOutcome: string;
  approvals?: EventApprovals;
  payload?: EventPayload;
};

export type ValidatedCreateEventRequest = {
  loop: string;
  sourceType: LoopSourceType;
  sourceRef?: string;
  assignedPersona?: PersonaId;
  workItemUrl: string;
  topLevelWorkItemUrl: string;
  requestedOutcome: string;
  approvals: EventApprovals;
  payload: EventPayload;
};

export type CreateEventResponse = {
  loop: Loop;
  events: Event[];
};

export type LoopSourceAdapter = {
  sourceType: LoopSourceType;
  buildSourceRef: (request: ValidatedCreateEventRequest) => string | undefined;
  buildContext: (request: ValidatedCreateEventRequest) => EventPayload;
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
  sourceType: LoopSourceType;
  sourceRef?: string;
  status: LoopEventStatus;
  assignee?: string;
  workItemUrl: string;
  topLevelWorkItemUrl: string;
  requestedOutcome: string;
  emittedByPersona: string;
  blocker?: string;
  approvals: EventApprovals;
  payload: EventPayload;
  completedAt?: Date;
};
