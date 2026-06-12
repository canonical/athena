import { getLoopForUser } from "@components/loop/loop.controller.js";
import { getPool } from "@components/postgres/postgres.js";
import type { CreateEventRequest, CreateEventResponse, Event, EventApprovals, EventInsert, EventPayload, ExecutionPersonaId, LoopPersonaHandler, LoopPersonaResult, PersonaId, ValidatedCreateEventRequest } from "./event.schema.js";
import { athenaPersonaId, engineeringManagerPersonaId, executionPersonaIds, personaIds } from "./event.schema.js";

const eventColumnNames = [`id`, `loop`, `sourceType`, `sourceRef`, `status`, `assignee`, `requestedOutcome`, `emittedByPersona`, `blocker`, `approvals`, `payload`, `emittedAt`, `completedAt`, `updatedAt`] as const;
const getEventColumns = (tableAlias?: string): string => eventColumnNames.map((column) => `${tableAlias ? `${tableAlias}.` : ``}"${column}"`).join(`, `);

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === `object` && !Array.isArray(value);

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== `string`) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : undefined;
};

const isPersonaId = (value: string): value is PersonaId => personaIds.includes(value as PersonaId);

const readPayloadString = (payload: EventPayload, key: string): string | undefined => normalizeString(payload[key]);

const summarizeObjectValues = (payload: EventPayload) =>
  Object.values(payload)
    .filter((value): value is string | number | boolean => typeof value === `string` || typeof value === `number` || typeof value === `boolean`)
    .map((value) => String(value))
    .join(` • `);

const buildSourceSummary = (sourceType: string, context: EventPayload): string => {
  const summary = summarizeObjectValues(context);

  return summary ? `${sourceType} context: ${summary}` : `${sourceType} context received.`;
};

const resolveSourceRef = (request: ValidatedCreateEventRequest): string | undefined =>
  request.sourceRef ??
  readPayloadString(request.payload, `sourceRef`) ??
  readPayloadString(request.payload, `reference`) ??
  readPayloadString(request.payload, `externalId`) ??
  (request.sourceType === `human-chat` ? readPayloadString(request.payload, `channel`) : undefined);

const buildSourceContext = (request: ValidatedCreateEventRequest, sourceRef: string | undefined): EventPayload => ({
  sourceType: request.sourceType,
  ...(sourceRef ? { sourceRef } : {}),
  ...request.payload,
});

const selectAssignee = (event: Pick<Event, "sourceType" | "sourceRef" | "requestedOutcome">): ExecutionPersonaId => {
  const seed = `${event.sourceType}:${event.sourceRef ?? ``}:${event.requestedOutcome ?? ``}`;
  const hash = [...seed].reduce((total, character, index) => total + character.charCodeAt(0) * (index + 1), 0);

  return executionPersonaIds[hash % executionPersonaIds.length] as ExecutionPersonaId;
};

const createCompletingPersonaHandler = (persona: ExecutionPersonaId): LoopPersonaHandler => ({
  persona,
  handle: (event) => ({
    status: `completed`,
    note: `${persona} completed the active responsibility for ${event.requestedOutcome ?? `the requested outcome`}.`,
  }),
});

const personaHandlers: Record<PersonaId, LoopPersonaHandler> = {
  [engineeringManagerPersonaId]: {
    persona: engineeringManagerPersonaId,
    handle: (event) => {
      const assignee = selectAssignee(event);

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
}: {
  approvals: EventApprovals;
  blocker?: string;
  context: string;
  nextExpectedAction: string;
  nextOwningPersona: string | null;
  status: string;
}) => ({
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
  approvals: EventApprovals;
  blocker?: string;
  context: string;
  nextExpectedAction: string;
  nextOwningPersona: string | null;
  note: string;
  request: ValidatedCreateEventRequest;
  sourceContext: EventPayload;
  status: string;
}): EventPayload => ({
  source: sourceContext,
  handoff: buildHandoff({
    approvals,
    blocker,
    context,
    nextExpectedAction,
    nextOwningPersona,
    status,
  }),
  note,
  input: request.payload,
});

const insertEvent = async (event: EventInsert): Promise<Event> => {
  const result = await getPool().query<Event>(
    `
      INSERT INTO "event" (
        "loop",
        "sourceType",
        "sourceRef",
        "status",
        "assignee",
        "requestedOutcome",
        "emittedByPersona",
        "blocker",
        "approvals",
        "payload",
        "completedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
      RETURNING ${getEventColumns()}
    `,
    [
      event.loop,
      event.sourceType,
      event.sourceRef ?? null,
      event.status,
      event.assignee ?? null,
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
    throw new Error(`Event was not created.`);
  }

  return createdEvent;
};

export class EventValidationError extends Error {}
export class EventAccessError extends Error {}

export const validateCreateEventRequest = (value: unknown): ValidatedCreateEventRequest => {
  if (!isRecord(value)) {
    throw new EventValidationError(`Event request body must be an object.`);
  }

  const loop = normalizeString(value.loop);
  const sourceType = normalizeString(value.sourceType);
  const requestedOutcome = normalizeString(value.requestedOutcome);
  const assignedPersonaValue = normalizeString(value.assignedPersona);

  if (!loop) {
    throw new EventValidationError(`loop is required.`);
  }

  if (!sourceType) {
    throw new EventValidationError(`sourceType is required.`);
  }

  if (!requestedOutcome) {
    throw new EventValidationError(`requestedOutcome is required.`);
  }

  if (assignedPersonaValue && !isPersonaId(assignedPersonaValue)) {
    throw new EventValidationError(`assignedPersona must be one of: ${personaIds.join(`, `)}.`);
  }

  const assignedPersona = assignedPersonaValue && isPersonaId(assignedPersonaValue) ? assignedPersonaValue : undefined;

  return {
    loop,
    sourceType,
    sourceRef: normalizeString(value.sourceRef),
    assignedPersona,
    requestedOutcome,
    approvals: Array.isArray(value.approvals) ? value.approvals : [],
    payload: isRecord(value.payload) ? value.payload : {},
  };
};

const createInitialEvent = async (request: ValidatedCreateEventRequest, sourceContext: EventPayload, sourceRef: string | undefined): Promise<Event> =>
  insertEvent({
    loop: request.loop,
    sourceType: request.sourceType,
    sourceRef,
    status: `created`,
    requestedOutcome: request.requestedOutcome,
    emittedByPersona: athenaPersonaId,
    approvals: request.approvals,
    payload: buildEventPayload({
      approvals: request.approvals,
      context: buildSourceSummary(request.sourceType, sourceContext),
      nextExpectedAction: request.assignedPersona ? `Route the event to ${request.assignedPersona}.` : `Ask ${engineeringManagerPersonaId} to assign a persona.`,
      nextOwningPersona: request.assignedPersona ?? engineeringManagerPersonaId,
      note: `Athena captured the incoming ${request.sourceType} event.`,
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
  request: ValidatedCreateEventRequest;
  sourceContext: EventPayload;
  sourceRef: string | undefined;
}): Promise<Event> =>
  insertEvent({
    loop: request.loop,
    sourceType: request.sourceType,
    sourceRef,
    status: `routed`,
    assignee,
    requestedOutcome: request.requestedOutcome,
    emittedByPersona,
    approvals: request.approvals,
    payload: buildEventPayload({
      approvals: request.approvals,
      context: buildSourceSummary(request.sourceType, sourceContext),
      nextExpectedAction: `Have ${assignee} complete the current responsibility for the work item.`,
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
  request: ValidatedCreateEventRequest;
  sourceContext: EventPayload;
  sourceRef: string | undefined;
}): Promise<Event> =>
  insertEvent({
    loop: request.loop,
    sourceType: request.sourceType,
    sourceRef,
    status: `completed`,
    assignee,
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
  request: ValidatedCreateEventRequest;
  sourceContext: EventPayload;
  sourceRef: string | undefined;
}): Promise<Event> =>
  insertEvent({
    loop: request.loop,
    sourceType: request.sourceType,
    sourceRef,
    status: `blocked`,
    assignee,
    requestedOutcome: request.requestedOutcome,
    emittedByPersona: assignee,
    blocker,
    approvals: request.approvals,
    payload: buildEventPayload({
      approvals: request.approvals,
      blocker,
      context: buildSourceSummary(request.sourceType, sourceContext),
      nextExpectedAction: assignee === engineeringManagerPersonaId ? `Notify the user that the event is blocked.` : `Route the blocker through ${engineeringManagerPersonaId}.`,
      nextOwningPersona: assignee === engineeringManagerPersonaId ? null : engineeringManagerPersonaId,
      note,
      request,
      sourceContext,
      status: `blocked`,
    }),
  });

const appendConclusionEvents = async ({
  request,
  result,
  sourceContext,
  sourceRef,
  timeline,
}: {
  request: ValidatedCreateEventRequest;
  result: LoopPersonaResult;
  sourceContext: EventPayload;
  sourceRef: string | undefined;
  timeline: Event[];
}): Promise<void> => {
  if (result.status === `completed`) {
    const assignee = timeline.at(-1)?.assignee;

    if (!assignee || !isPersonaId(assignee)) {
      throw new Error(`A completing event requires an assigned persona.`);
    }

    timeline.push(
      await createCompletedEvent({
        assignee,
        note: result.note,
        request,
        sourceContext,
        sourceRef,
      }),
    );
    return;
  }

  if (result.status === `blocked`) {
    const assignee = timeline.at(-1)?.assignee;

    if (!assignee || !isPersonaId(assignee)) {
      throw new Error(`A blocked event requires an assigned persona.`);
    }

    timeline.push(
      await createBlockedEvent({
        assignee,
        blocker: result.blocker,
        note: result.note,
        request,
        sourceContext,
        sourceRef,
      }),
    );
    return;
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

  await appendConclusionEvents({
    request,
    result: completionResult,
    sourceContext,
    sourceRef,
    timeline,
  });
};

export const createEvent = async (input: CreateEventRequest, userId: string): Promise<CreateEventResponse> => {
  const request = validateCreateEventRequest(input);
  const loop = await getLoopForUser(request.loop, userId);

  if (!loop) {
    throw new EventAccessError(`Loop not found.`);
  }

  const sourceRef = resolveSourceRef(request);
  const sourceContext = buildSourceContext(request, sourceRef);
  const events: Event[] = [];

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
    await appendConclusionEvents({
      request,
      result: completionResult,
      sourceContext,
      sourceRef,
      timeline: events,
    });

    return {
      loop,
      events,
    };
  }

  const assignmentResult = personaHandlers[engineeringManagerPersonaId].handle(initialEvent);
  await appendConclusionEvents({
    request,
    result: assignmentResult,
    sourceContext,
    sourceRef,
    timeline: events,
  });

  return {
    loop,
    events,
  };
};

export const listEvents = async (userId: string): Promise<Event[]> => {
  const result = await getPool().query<Event>(
    `
      SELECT ${getEventColumns(`e`)}
      FROM "event" e
      JOIN "loopUser" lu ON lu."loop" = e."loop"
      WHERE lu."user" = $1
      ORDER BY e."emittedAt" DESC
    `,
    [userId],
  );

  return result.rows;
};
