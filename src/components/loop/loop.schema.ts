export const athenaPersonaId = `athena` as const;
export const engineeringManagerPersonaId = `em.diana` as const;
export const personaIds = [engineeringManagerPersonaId, `pm.alice`, `pm.beatrice`, `ic.clara`, `cr.elena`, `ux.fiona`, `qa.grace`] as const;
export const executionPersonaIds = personaIds.filter((persona) => persona !== engineeringManagerPersonaId);
export const loopSourceTypes = [`github`, `jira`, `human-chat`] as const;
export const loopEventStatuses = [`created`, `routed`, `completed`, `blocked`] as const;
export const loopOutcomes = [`completed`, `blocked`] as const;

export type AthenaPersonaId = typeof athenaPersonaId;
export type PersonaId = (typeof personaIds)[number];
export type ExecutionPersonaId = (typeof executionPersonaIds)[number];
export type LoopSourceType = (typeof loopSourceTypes)[number];
export type LoopEventStatus = (typeof loopEventStatuses)[number];
export type LoopOutcome = (typeof loopOutcomes)[number];
export type LoopPayload = Record<string, unknown>;
export type LoopApprovals = unknown[];

export type Loop = {
  id: string;
  project: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LoopInsert = {
  project: string;
  name: string;
  description?: string;
};

export type LoopUser = {
  loop: string;
  user: string;
  createdAt: Date;
};

export type Event = {
  id: string;
  loop: string;
  user: string;
  sourceType: string;
  sourceRef: string | null;
  status: string;
  assignee: string | null;
  workItemUrl: string | null;
  topLevelWorkItemUrl: string | null;
  requestedOutcome: string | null;
  emittedByPersona: string | null;
  blocker: string | null;
  approvals: LoopApprovals;
  payload: LoopPayload;
  emittedAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
};

export type RunLoopRequest = {
  project: string;
  name?: string;
  description?: string;
  sourceType: string;
  sourceRef?: string;
  assignedPersona?: string;
  workItemUrl: string;
  topLevelWorkItemUrl?: string;
  requestedOutcome: string;
  approvals?: LoopApprovals;
  payload?: LoopPayload;
};

export type ValidatedRunLoopRequest = {
  project: string;
  name: string;
  description: string | undefined;
  sourceType: LoopSourceType;
  sourceRef?: string;
  assignedPersona?: PersonaId;
  workItemUrl: string;
  topLevelWorkItemUrl: string;
  requestedOutcome: string;
  approvals: LoopApprovals;
  payload: LoopPayload;
};

export type RunLoopResponse = {
  loop: Loop;
  events: Event[];
  finalEvent: Event;
};

export type LoopSourceAdapter = {
  sourceType: LoopSourceType;
  buildSourceRef: (request: ValidatedRunLoopRequest) => string | undefined;
  buildContext: (request: ValidatedRunLoopRequest) => LoopPayload;
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
  user: string;
  sourceType: LoopSourceType;
  sourceRef?: string;
  status: LoopEventStatus;
  assignee?: string;
  workItemUrl: string;
  topLevelWorkItemUrl: string;
  requestedOutcome: string;
  emittedByPersona: string;
  blocker?: string;
  approvals: LoopApprovals;
  payload: LoopPayload;
  completedAt?: Date;
};
