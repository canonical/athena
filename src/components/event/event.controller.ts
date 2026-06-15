import { queryLoopForUser } from "@components/loop/loop.service.js";
import type {
  BlockedEventCreation,
  ConcludedEventCreation,
  CreateEventRequest,
  CreateEventResponse,
  Event,
  EventFollowUpRequest,
  EventPayload,
  EventPayloadBuildInput,
  EventSourceContext,
  ExecutionPersonaId,
  HandoffBuildInput,
  LoopPersonaHandler,
  PersonaId,
  RoutedEventCreation,
  ValidatedCreateEventRequest,
} from "./event.schema.js";
import { athenaPersonaId, engineeringManagerPersonaId, executionPersonaIds, personaIds } from "./event.schema.js";
import { queryEventCreate, queryEventList } from "./event.service.js";

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

const buildSourceSummary = (sourceType: string, sourcePayload: EventPayload): string => {
  const summary = summarizeObjectValues(sourcePayload);

  return summary ? `${sourceType} payload: ${summary}` : `${sourceType} payload received.`;
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

const getPersonaHandler = (persona: PersonaId): LoopPersonaHandler => {
  const handler = personaHandlers[persona];

  if (!handler) {
    throw new Error(`Unsupported persona: ${persona}.`);
  }

  return handler;
};

const buildHandoff = ({ approvals, blocker, context, nextExpectedAction, nextOwningPersona, status }: HandoffBuildInput) => ({
  currentStatus: status,
  relevantContextAndDecisions: context,
  dependenciesAndBlockers: blocker ? [blocker] : [],
  requiredApprovalsAlreadyObtained: approvals,
  nextExpectedAction,
  nextOwningPersona,
});

const buildEventPayload = ({ approvals, blocker, context, nextExpectedAction, nextOwningPersona, note, request, sourcePayload, status }: EventPayloadBuildInput): EventPayload => ({
  source: sourcePayload,
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

const getAssignedPersona = (event: Event): PersonaId => {
  if (!event.assignee || !isPersonaId(event.assignee)) {
    throw new Error(`A concluding event requires an assigned persona.`);
  }

  return event.assignee;
};

const createInitialEvent = async ({ request, sourcePayload, sourceRef }: EventSourceContext): Promise<Event> =>
  queryEventCreate({
    loop: request.loop,
    sourceType: request.sourceType,
    sourceRef,
    status: `created`,
    requestedOutcome: request.requestedOutcome,
    emittedByPersona: athenaPersonaId,
    approvals: request.approvals,
    payload: buildEventPayload({
      approvals: request.approvals,
      context: buildSourceSummary(request.sourceType, sourcePayload),
      nextExpectedAction: request.assignedPersona ? `Route the event to ${request.assignedPersona}.` : `Ask ${engineeringManagerPersonaId} to assign a persona.`,
      nextOwningPersona: request.assignedPersona ?? engineeringManagerPersonaId,
      note: `Athena captured the incoming ${request.sourceType} event.`,
      request,
      sourcePayload,
      status: `created`,
    }),
  });

const createRoutedEvent = async ({ assignee, emittedByPersona, note, request, sourcePayload, sourceRef }: RoutedEventCreation): Promise<Event> =>
  queryEventCreate({
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
      context: buildSourceSummary(request.sourceType, sourcePayload),
      nextExpectedAction: `Have ${assignee} complete the current responsibility for the work item.`,
      nextOwningPersona: assignee,
      note,
      request,
      sourcePayload,
      status: `routed`,
    }),
  });

const createCompletedEvent = async ({ assignee, note, request, sourcePayload, sourceRef }: ConcludedEventCreation): Promise<Event> =>
  queryEventCreate({
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
      context: buildSourceSummary(request.sourceType, sourcePayload),
      nextExpectedAction: `Notify the user that the requested outcome is complete.`,
      nextOwningPersona: null,
      note,
      request,
      sourcePayload,
      status: `completed`,
    }),
    completedAt: new Date(),
  });

const createBlockedEvent = async ({ assignee, blocker, note, request, sourcePayload, sourceRef }: BlockedEventCreation): Promise<Event> =>
  queryEventCreate({
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
      context: buildSourceSummary(request.sourceType, sourcePayload),
      nextExpectedAction: assignee === engineeringManagerPersonaId ? `Notify the user that the event is blocked.` : `Route the blocker through ${engineeringManagerPersonaId}.`,
      nextOwningPersona: assignee === engineeringManagerPersonaId ? null : engineeringManagerPersonaId,
      note,
      request,
      sourcePayload,
      status: `blocked`,
    }),
  });

const createFollowUpEvents = async ({ currentEvent, request, result, sourcePayload, sourceRef }: EventFollowUpRequest): Promise<Event[]> => {
  if (result.status === `completed`) {
    return [
      await createCompletedEvent({
        assignee: getAssignedPersona(currentEvent),
        note: result.note,
        request,
        sourcePayload,
        sourceRef,
      }),
    ];
  }

  if (result.status === `blocked`) {
    return [
      await createBlockedEvent({
        assignee: getAssignedPersona(currentEvent),
        blocker: result.blocker,
        note: result.note,
        request,
        sourcePayload,
        sourceRef,
      }),
    ];
  }

  const routedEvent = await createRoutedEvent({
    assignee: result.assignee,
    emittedByPersona: engineeringManagerPersonaId,
    note: result.note,
    request,
    sourcePayload,
    sourceRef,
  });
  const completionResult = getPersonaHandler(result.assignee).handle(routedEvent);

  return [
    routedEvent,
    ...(await createFollowUpEvents({
      currentEvent: routedEvent,
      request,
      result: completionResult,
      sourcePayload,
      sourceRef,
    })),
  ];
};

export const eventCreate = async (input: CreateEventRequest, userId: string): Promise<CreateEventResponse> => {
  const request = validateCreateEventRequest(input);
  const loop = await queryLoopForUser(request.loop, userId);

  if (!loop) {
    throw new EventAccessError(`Loop not found.`);
  }

  const sourceRef = resolveSourceRef(request);
  const sourcePayload = buildSourceContext(request, sourceRef);
  const eventContext = {
    request,
    sourcePayload,
    sourceRef,
  } satisfies EventSourceContext;

  const initialEvent = await createInitialEvent(eventContext);

  if (request.assignedPersona) {
    const routedEvent = await createRoutedEvent({
      ...eventContext,
      assignee: request.assignedPersona,
      emittedByPersona: athenaPersonaId,
      note: `${athenaPersonaId} routed the event to ${request.assignedPersona}.`,
    });

    const completionResult = getPersonaHandler(request.assignedPersona).handle(routedEvent);
    const followUpEvents = await createFollowUpEvents({
      ...eventContext,
      currentEvent: routedEvent,
      result: completionResult,
    });

    return {
      loop,
      events: [initialEvent, routedEvent, ...followUpEvents],
    };
  }

  const assignmentResult = getPersonaHandler(engineeringManagerPersonaId).handle(initialEvent);
  const followUpEvents = await createFollowUpEvents({
    ...eventContext,
    currentEvent: initialEvent,
    result: assignmentResult,
  });

  return {
    loop,
    events: [initialEvent, ...followUpEvents],
  };
};

export const eventList = async (userId: string): Promise<Event[]> => queryEventList(userId);
