import { getApiUrl } from "@components/config/frontend.client.js";

export const loopApiPaths = {
  events: getApiUrl(`/loop/events`),
} as const;

export type LoopEventSummary = {
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

export const fetchLoopEvents = async (): Promise<LoopEventSummary[]> => {
  const response = await fetch(loopApiPaths.events, { credentials: `include` });

  if (!response.ok) {
    throw new Error(`Loop events request failed with status ${response.status}`);
  }

  return response.json() as Promise<LoopEventSummary[]>;
};
