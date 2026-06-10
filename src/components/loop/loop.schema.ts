export const athenaPersonaId = `athena` as const;
export const engineeringManagerPersonaId = `em.diana` as const;
export const personaIds = [engineeringManagerPersonaId, `pm.alice`, `pm.beatrice`, `ic.clara`, `cr.elena`, `ux.fiona`, `qa.grace`] as const;
export const executionPersonaIds = personaIds.filter((personaId) => personaId !== engineeringManagerPersonaId);
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

export type LoopEventRecord = {
  id: string;
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
  outcome: LoopOutcome;
  events: LoopEventRecord[];
  finalEvent: LoopEventRecord;
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
  personaId: PersonaId;
  handle: (event: LoopEventRecord) => LoopPersonaResult;
};

export type LoopEventInsert = {
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
