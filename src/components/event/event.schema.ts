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
  approvals: unknown[];
  payload: Record<string, unknown>;
  emittedAt: string;
  completedAt: string | null;
  updatedAt: string;
};
