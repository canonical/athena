import { getPool } from "@components/postgres/postgres.js";
import type {
  ExecutionPersonaId,
  LoopApprovals,
  LoopEventInsert,
  LoopEventRecord,
  LoopOutcome,
  LoopPayload,
  LoopPersonaHandler,
  LoopPersonaResult,
  LoopSourceAdapter,
  LoopSourceType,
  PersonaId,
  RunLoopRequest,
  RunLoopResponse,
  ValidatedRunLoopRequest,
} from "./loop.schema.js";
import { athenaPersonaId, engineeringManagerPersonaId, executionPersonaIds, loopSourceTypes, personaIds } from "./loop.schema.js";

const loopEventColumns = `
  "id",
  "sourceType",
  "sourceRef",
  "status",
  "assignee",
  "workItemUrl",
  "topLevelWorkItemUrl",
  "requestedOutcome",
  "emittedByPersona",
  "blocker",
  "approvals",
  "payload",
  "emittedAt",
  "completedAt",
  "updatedAt"
`;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === `object` && !Array.isArray(value);

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== `string`) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : undefined;
};

const isLoopSourceType = (value: string): value is LoopSourceType => loopSourceTypes.includes(value as LoopSourceType);
const isPersonaId = (value: string): value is PersonaId => personaIds.includes(value as PersonaId);

const summarizeObjectValues = (payload: LoopPayload) =>
  Object.values(payload)
    .filter((value): value is string | number | boolean => typeof value === `string` || typeof value === `number` || typeof value === `boolean`)
    .map((value) => String(value))
    .join(` • `);

const buildSourceSummary = (sourceType: LoopSourceType, context: LoopPayload): string => {
  const summary = summarizeObjectValues(context);

  return summary ? `${sourceType} mock context: ${summary}` : `${sourceType} mock context received.`;
};

const extractGitHubPullRequestRef = (payload: LoopPayload): string | undefined => {
  const repository = normalizeString(payload.repository);
  const pullRequest = typeof payload.pullRequest === `number` || typeof payload.pullRequest === `string` ? String(payload.pullRequest) : undefined;

  return repository && pullRequest ? `${repository}#${pullRequest}` : repository;
};

const extractJiraRef = (payload: LoopPayload, workItemUrl: string): string | undefined => normalizeString(payload.issueKey) ?? normalizeString(workItemUrl.split(`/`).at(-1));
const extractHumanChatRef = (payload: LoopPayload): string | undefined => normalizeString(payload.conversationId) ?? normalizeString(payload.channel);

const sourceAdapters: Record<LoopSourceType, LoopSourceAdapter> = {
  github: {
    sourceType: `github`,
    buildSourceRef: (request) => extractGitHubPullRequestRef(request.payload) ?? request.sourceRef,
    buildContext: (request) => ({
      sourceType: `github`,
      repository: normalizeString(request.payload.repository) ?? `canonical/athena`,
      action: normalizeString(request.payload.action) ?? `opened`,
      pullRequest: request.payload.pullRequest ?? 0,
      title: normalizeString(request.payload.title) ?? request.requestedOutcome,
    }),
  },
  jira: {
    sourceType: `jira`,
    buildSourceRef: (request) => extractJiraRef(request.payload, request.workItemUrl) ?? request.sourceRef,
    buildContext: (request) => ({
      sourceType: `jira`,
      issueKey: extractJiraRef(request.payload, request.workItemUrl) ?? `ATH-0`,
      transition: normalizeString(request.payload.transition) ?? `updated`,
      summary: normalizeString(request.payload.summary) ?? request.requestedOutcome,
    }),
  },
  "human-chat": {
    sourceType: `human-chat`,
    buildSourceRef: (request) => extractHumanChatRef(request.payload) ?? request.sourceRef,
    buildContext: (request) => ({
      sourceType: `human-chat`,
      author: normalizeString(request.payload.author) ?? `user`,
      channel: normalizeString(request.payload.channel) ?? `web-chat`,
      message: normalizeString(request.payload.message) ?? request.requestedOutcome,
    }),
  },
};

const selectMockAssignee = (event: Pick<LoopEventRecord, "sourceType" | "sourceRef" | "requestedOutcome" | "workItemUrl">): ExecutionPersonaId => {
  const seed = `${event.sourceType}:${event.sourceRef ?? ``}:${event.requestedOutcome ?? ``}:${event.workItemUrl ?? ``}`;
  const hash = [...seed].reduce((total, character, index) => total + character.charCodeAt(0) * (index + 1), 0);

  return executionPersonaIds[hash % executionPersonaIds.length] as ExecutionPersonaId;
};

const createCompletingPersonaHandler = (personaId: ExecutionPersonaId): LoopPersonaHandler => ({
  personaId,
  handle: (event) => ({
    status: `completed`,
    note: `${personaId} completed the active responsibility for ${event.requestedOutcome ?? `the requested outcome`}.`,
  }),
});

const personaHandlers: Record<PersonaId, LoopPersonaHandler> = {
  [engineeringManagerPersonaId]: {
    personaId: engineeringManagerPersonaId,
    handle: (event) => {
      const assignee = selectMockAssignee(event);

      return {
        status: `routed`,
        assignee,
        note: `${engineeringManagerPersonaId} assigned the work to ${assignee}.`,
      };
    },
  },
  "pm.alice": createCompletingPersonaHandler(`pm.alice`),
  "pm.beatrice": createCompletingPersonaHandler(`pm.beatrice`),
  "ic.clara": createCompletingPersonaHandler(`ic.clara`),
  "cr.elena": createCompletingPersonaHandler(`cr.elena`),
  "ux.fiona": createCompletingPersonaHandler(`ux.fiona`),
  "qa.grace": createCompletingPersonaHandler(`qa.grace`),
};

const buildHandoff = ({
  approvals,
  blocker,
  context,
  nextExpectedAction,
  nextOwningPersona,
  status,
  workItemUrl,
}: {
  approvals: LoopApprovals;
  blocker?: string;
  context: string;
  nextExpectedAction: string;
  nextOwningPersona: string | null;
  status: string;
  workItemUrl: string;
}) => ({
  jiraItem: workItemUrl,
  currentStatus: status,
  relevantContextAndDecisions: context,
  dependenciesAndBlockers: blocker ? [blocker] : [],
  requiredApprovalsAlreadyObtained: approvals,
  nextExpectedAction,
  nextOwningPersona,
});

const buildEventPayload = ({
  approvals,
  blocker,
  context,
  nextExpectedAction,
  nextOwningPersona,
  note,
  request,
  sourceContext,
  status,
}: {
  approvals: LoopApprovals;
  blocker?: string;
  context: string;
  nextExpectedAction: string;
  nextOwningPersona: string | null;
  note: string;
  request: ValidatedRunLoopRequest;
  sourceContext: LoopPayload;
  status: string;
}): LoopPayload => ({
  source: sourceContext,
  handoff: buildHandoff({
    approvals,
    blocker,
    context,
    nextExpectedAction,
    nextOwningPersona,
    status,
    workItemUrl: request.workItemUrl,
  }),
  mock: {
    note,
    requestedOutcome: request.requestedOutcome,
    topLevelWorkItemUrl: request.topLevelWorkItemUrl,
  },
  input: request.payload,
});

const insertLoopEvent = async (event: LoopEventInsert): Promise<LoopEventRecord> => {
  const result = await getPool().query<LoopEventRecord>(
    `
      INSERT INTO "event" (
        "sourceType",
        "sourceRef",
        "status",
        "assignee",
        "workItemUrl",
        "topLevelWorkItemUrl",
        "requestedOutcome",
        "emittedByPersona",
        "blocker",
        "approvals",
        "payload",
        "completedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12)
      RETURNING ${loopEventColumns}
    `,
    [
      event.sourceType,
      event.sourceRef ?? null,
      event.status,
      event.assignee ?? null,
      event.workItemUrl,
      event.topLevelWorkItemUrl,
      event.requestedOutcome,
      event.emittedByPersona,
      event.blocker ?? null,
      JSON.stringify(event.approvals),
      JSON.stringify(event.payload),
      event.completedAt ?? null,
    ],
  );

  const createdEvent = result.rows[0];

  if (!createdEvent) {
    throw new Error(`Loop event was not created.`);
  }

  return createdEvent;
};

export class LoopValidationError extends Error {}

export const validateRunLoopRequest = (value: unknown): ValidatedRunLoopRequest => {
  if (!isRecord(value)) {
    throw new LoopValidationError(`Loop request body must be an object.`);
  }

  const sourceType = normalizeString(value.sourceType);
  const workItemUrl = normalizeString(value.workItemUrl);
  const requestedOutcome = normalizeString(value.requestedOutcome);
  const assignedPersonaValue = normalizeString(value.assignedPersona);

  if (!sourceType || !isLoopSourceType(sourceType)) {
    throw new LoopValidationError(`sourceType must be one of: ${loopSourceTypes.join(`, `)}.`);
  }

  if (!workItemUrl) {
    throw new LoopValidationError(`workItemUrl is required.`);
  }

  if (!requestedOutcome) {
    throw new LoopValidationError(`requestedOutcome is required.`);
  }

  if (assignedPersonaValue && !isPersonaId(assignedPersonaValue)) {
    throw new LoopValidationError(`assignedPersona must be one of: ${personaIds.join(`, `)}.`);
  }

  const assignedPersona = assignedPersonaValue && isPersonaId(assignedPersonaValue) ? assignedPersonaValue : undefined;

  return {
    sourceType,
    sourceRef: normalizeString(value.sourceRef),
    assignedPersona,
    workItemUrl,
    topLevelWorkItemUrl: normalizeString(value.topLevelWorkItemUrl) ?? workItemUrl,
    requestedOutcome,
    approvals: Array.isArray(value.approvals) ? value.approvals : [],
    payload: isRecord(value.payload) ? value.payload : {},
  };
};

const createInitialEvent = async (request: ValidatedRunLoopRequest, sourceContext: LoopPayload, sourceRef: string | undefined): Promise<LoopEventRecord> =>
  insertLoopEvent({
    sourceType: request.sourceType,
    sourceRef,
    status: `created`,
    workItemUrl: request.workItemUrl,
    topLevelWorkItemUrl: request.topLevelWorkItemUrl,
    requestedOutcome: request.requestedOutcome,
    emittedByPersona: athenaPersonaId,
    approvals: request.approvals,
    payload: buildEventPayload({
      approvals: request.approvals,
      context: buildSourceSummary(request.sourceType, sourceContext),
      nextExpectedAction: request.assignedPersona ? `Route the event to ${request.assignedPersona}.` : `Ask ${engineeringManagerPersonaId} to assign a persona.`,
      nextOwningPersona: request.assignedPersona ?? engineeringManagerPersonaId,
      note: `Athena captured the incoming ${request.sourceType} mock event.`,
      request,
      sourceContext,
      status: `created`,
    }),
  });

const createRoutedEvent = async ({
  assignee,
  emittedByPersona,
  note,
  request,
  sourceContext,
  sourceRef,
}: {
  assignee: PersonaId;
  emittedByPersona: string;
  note: string;
  request: ValidatedRunLoopRequest;
  sourceContext: LoopPayload;
  sourceRef: string | undefined;
}): Promise<LoopEventRecord> =>
  insertLoopEvent({
    sourceType: request.sourceType,
    sourceRef,
    status: `routed`,
    assignee,
    workItemUrl: request.workItemUrl,
    topLevelWorkItemUrl: request.topLevelWorkItemUrl,
    requestedOutcome: request.requestedOutcome,
    emittedByPersona,
    approvals: request.approvals,
    payload: buildEventPayload({
      approvals: request.approvals,
      context: buildSourceSummary(request.sourceType, sourceContext),
      nextExpectedAction: `Have ${assignee} complete the current responsibility for the Jira item.`,
      nextOwningPersona: assignee,
      note,
      request,
      sourceContext,
      status: `routed`,
    }),
  });

const createCompletedEvent = async ({
  assignee,
  note,
  request,
  sourceContext,
  sourceRef,
}: {
  assignee: PersonaId;
  note: string;
  request: ValidatedRunLoopRequest;
  sourceContext: LoopPayload;
  sourceRef: string | undefined;
}): Promise<LoopEventRecord> =>
  insertLoopEvent({
    sourceType: request.sourceType,
    sourceRef,
    status: `completed`,
    assignee,
    workItemUrl: request.workItemUrl,
    topLevelWorkItemUrl: request.topLevelWorkItemUrl,
    requestedOutcome: request.requestedOutcome,
    emittedByPersona: assignee,
    approvals: request.approvals,
    payload: buildEventPayload({
      approvals: request.approvals,
      context: buildSourceSummary(request.sourceType, sourceContext),
      nextExpectedAction: `Notify the user that the requested outcome is complete.`,
      nextOwningPersona: null,
      note,
      request,
      sourceContext,
      status: `completed`,
    }),
    completedAt: new Date(),
  });

const createBlockedEvent = async ({
  assignee,
  blocker,
  note,
  request,
  sourceContext,
  sourceRef,
}: {
  assignee: PersonaId;
  blocker: string;
  note: string;
  request: ValidatedRunLoopRequest;
  sourceContext: LoopPayload;
  sourceRef: string | undefined;
}): Promise<LoopEventRecord> =>
  insertLoopEvent({
    sourceType: request.sourceType,
    sourceRef,
    status: `blocked`,
    assignee,
    workItemUrl: request.workItemUrl,
    topLevelWorkItemUrl: request.topLevelWorkItemUrl,
    requestedOutcome: request.requestedOutcome,
    emittedByPersona: assignee,
    blocker,
    approvals: request.approvals,
    payload: buildEventPayload({
      approvals: request.approvals,
      blocker,
      context: buildSourceSummary(request.sourceType, sourceContext),
      nextExpectedAction: assignee === engineeringManagerPersonaId ? `Notify the user that the loop is blocked.` : `Route the blocker through ${engineeringManagerPersonaId}.`,
      nextOwningPersona: assignee === engineeringManagerPersonaId ? null : engineeringManagerPersonaId,
      note,
      request,
      sourceContext,
      status: `blocked`,
    }),
  });

const resolveLoopOutcome = async ({
  request,
  result,
  sourceContext,
  sourceRef,
  timeline,
}: {
  request: ValidatedRunLoopRequest;
  result: LoopPersonaResult;
  sourceContext: LoopPayload;
  sourceRef: string | undefined;
  timeline: LoopEventRecord[];
}): Promise<{ outcome: LoopOutcome; finalEvent: LoopEventRecord }> => {
  if (result.status === `completed`) {
    const assignee = timeline.at(-1)?.assignee;

    if (!assignee || !isPersonaId(assignee)) {
      throw new Error(`A completing loop event requires an assigned persona.`);
    }

    const finalEvent = await createCompletedEvent({
      assignee,
      note: result.note,
      request,
      sourceContext,
      sourceRef,
    });

    timeline.push(finalEvent);
    return { outcome: `completed`, finalEvent };
  }

  if (result.status === `blocked`) {
    const assignee = timeline.at(-1)?.assignee;

    if (!assignee || !isPersonaId(assignee)) {
      throw new Error(`A blocked loop event requires an assigned persona.`);
    }

    const finalEvent = await createBlockedEvent({
      assignee,
      blocker: result.blocker,
      note: result.note,
      request,
      sourceContext,
      sourceRef,
    });

    timeline.push(finalEvent);
    return { outcome: `blocked`, finalEvent };
  }

  const routedEvent = await createRoutedEvent({
    assignee: result.assignee,
    emittedByPersona: engineeringManagerPersonaId,
    note: result.note,
    request,
    sourceContext,
    sourceRef,
  });

  timeline.push(routedEvent);
  const completionResult = personaHandlers[result.assignee].handle(routedEvent);

  return resolveLoopOutcome({
    request,
    result: completionResult,
    sourceContext,
    sourceRef,
    timeline,
  });
};

export const runLoop = async (input: RunLoopRequest): Promise<RunLoopResponse> => {
  const request = validateRunLoopRequest(input);
  const sourceAdapter = sourceAdapters[request.sourceType];
  const sourceContext = sourceAdapter.buildContext(request);
  const sourceRef = sourceAdapter.buildSourceRef(request);
  const events: LoopEventRecord[] = [];

  const initialEvent = await createInitialEvent(request, sourceContext, sourceRef);
  events.push(initialEvent);

  if (request.assignedPersona) {
    const routedEvent = await createRoutedEvent({
      assignee: request.assignedPersona,
      emittedByPersona: athenaPersonaId,
      note: `${athenaPersonaId} routed the event to ${request.assignedPersona}.`,
      request,
      sourceContext,
      sourceRef,
    });

    events.push(routedEvent);
    const completionResult = personaHandlers[request.assignedPersona].handle(routedEvent);
    const { outcome, finalEvent } = await resolveLoopOutcome({
      request,
      result: completionResult,
      sourceContext,
      sourceRef,
      timeline: events,
    });

    return {
      outcome,
      events,
      finalEvent,
    };
  }

  const assignmentResult = personaHandlers[engineeringManagerPersonaId].handle(initialEvent);
  const { outcome, finalEvent } = await resolveLoopOutcome({
    request,
    result: assignmentResult,
    sourceContext,
    sourceRef,
    timeline: events,
  });

  return {
    outcome,
    events,
    finalEvent,
  };
};
