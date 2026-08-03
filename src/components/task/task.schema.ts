import { loopSchema } from "@components/loop/loop.schema.js";
import type { PersonaId } from "@components/persona/persona.schema.js";

import { providerModelSchema } from "@components/provider/provider.schema.js";
import { isoDateTime, normalizedString, requiredString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

export const taskPhases = [`routing`, `execution`, `done`] as const;
export type TaskPhase = (typeof taskPhases)[number];

export const taskStatuses = [`active`, `queued`, `processing`, `requires-user-input`, `completed`, `blocked`, `pool-not-ready`] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const taskSourceTypes = [`chat-ui`] as const;
export type TaskSourceType = (typeof taskSourceTypes)[number];

export const taskChatPayloadSchema = z.object({
  messageType: z.enum([`user`, `assistant`]).optional(),
  message: z.string(),
  channel: z.string().optional(),
});
export type TaskChatPayload = z.infer<typeof taskChatPayloadSchema>;

export const taskRoutingPayloadSchema = z.object({
  selectedPersona: uuid().optional(),
  selectedPersonaDisplayName: z.string().optional(),
  selectedModel: z.string().optional(),
  targetType: z.enum([`provider`, `runner`]).optional(),
  conversationMode: z.string().optional(),
  routeReasonCode: z.string().optional(),
  routeReasonText: z.string().optional(),
});
export type TaskRoutingPayload = z.infer<typeof taskRoutingPayloadSchema>;

export const taskKinds = [`coding`, `jira-refinement`, `analysis`, `other`] as const;
export type TaskKind = (typeof taskKinds)[number];

export const taskOwnerModes = [`ai`, `human`, `mixed`] as const;
export type TaskOwnerMode = (typeof taskOwnerModes)[number];

export const taskRoutingMetaSchema = z.object({
  routeAttempts: z.number().int().nonnegative(),
  lastRoutedAt: isoDateTime.nullable(),
  lastRoutedByPersona: uuid().nullable(),
  lastRouteReasonCode: z.string().nullable(),
});
export type TaskRoutingMeta = z.infer<typeof taskRoutingMetaSchema>;

export const timelineEntryTypes = [`task-created`, `chat-session`, `routing-decision`, `llm-call`, `system-action-started`, `system-action-result`, `waiting-user-input`, `user-approval`, `task-completed`, `task-blocked`] as const;
export type TimelineEntryType = (typeof timelineEntryTypes)[number];

export const timelineChatTurnSchema = z.object({
  speaker: z.enum([`user`, `assistant`, `system`]),
  message: z.string(),
});
export type TimelineChatTurn = z.infer<typeof timelineChatTurnSchema>;

export const timelineEntrySchema = z.object({
  id: uuid(),
  timestamp: isoDateTime,
  type: z.enum(timelineEntryTypes),
  actor: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;

export const taskPayloadSchema = z
  .object({
    channel: z.string().optional(),
    chat: taskChatPayloadSchema.optional(),
    routing: taskRoutingPayloadSchema.optional(),
    timeline: z.array(timelineEntrySchema).default([]),
  })
  .loose();
export type TaskPayload = z.infer<typeof taskPayloadSchema>;

export const taskApprovalsSchema = z.array(z.unknown());
export type TaskApprovals = z.infer<typeof taskApprovalsSchema>;

export const routeReasonCodes = [`ROUTED_FROM_FIRST_MESSAGE`, `ROUTED_FROM_CONVERSATION_CONTEXT`, `REUSED_PREVIOUS_SELECTION`, `MANUAL_OVERRIDE`] as const;
export type RouteReasonCode = (typeof routeReasonCodes)[number];

export const routeDecisionSchema = z.object({
  selectedPersona: uuid(),
  selectedModel: z.string(),
  targetType: z.enum([`provider`, `runner`]),
  routeReasonCode: z.enum(routeReasonCodes),
  routeReasonText: z.string(),
});
export type RouteDecision = z.infer<typeof routeDecisionSchema>;

export const routingLlmRouteDecisionSchema = z.object({
  selectedPersona: uuid(),
  selectedModel: z.string(),
  targetType: z.enum([`provider`, `runner`]),
  routeReasonText: z.string(),
});
export type RoutingLlmRouteDecision = z.infer<typeof routingLlmRouteDecisionSchema>;

export const routingProviderConnectionSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  routingModel: z.string(),
  defaultModel: z.string().nullable(),
  enabledModels: z.array(z.string()),
  availableModels: z.array(providerModelSchema),
});
export type RoutingProviderConnection = z.infer<typeof routingProviderConnectionSchema>;

export const routeSelectionOptionSchema = z.object({
  id: uuid(),
  displayName: z.string(),
  role: z.string().nullable(),
});
export type RouteSelectionOption = z.infer<typeof routeSelectionOptionSchema>;

export const routeSelectionRequiredSchema = z.object({
  code: z.literal(`ROUTE_SELECTION_REQUIRED`),
  message: z.string(),
  options: z.array(routeSelectionOptionSchema),
});
export type RouteSelectionRequired = z.infer<typeof routeSelectionRequiredSchema>;

// Flattened task schema — work fields live at the top level
export const taskSchema = z.object({
  id: uuid(),
  loop: uuid(),
  phase: z.enum(taskPhases),
  sourceType: z.enum(taskSourceTypes),
  sourceRef: z.string().nullable(),
  status: z.enum(taskStatuses),
  assignee: uuid().nullable(),
  selectedPersona: uuid().nullable(),
  targetType: z.enum([`provider`, `runner`]).nullable(),
  targetId: uuid().nullable(),
  routeReasonCode: z.string().nullable(),
  routeReasonText: z.string().nullable(),
  // Work definition (formerly split between requestedOutcome and task.objective)
  description: z.string().nullable(),
  kind: z.enum(taskKinds),
  ownerMode: z.enum(taskOwnerModes),
  successCriteria: z.array(z.string()),
  externalRefs: z.array(z.string()),
  // Execution state
  context: z.string(),
  routing: taskRoutingMetaSchema,
  // Metadata
  emittedByPersona: uuid().nullable(),
  blocker: z.string().nullable(),
  approvals: taskApprovalsSchema,
  payload: taskPayloadSchema,
  emittedAt: isoDateTime,
  completedAt: isoDateTime.nullable(),
  claimToken: uuid().nullable(),
  claimOwner: z.string().nullable(),
  pingedAt: isoDateTime.nullable(),
  processingSourceStatus: z.enum(taskStatuses).nullable(),
  claimAttemptCount: z.number().int().nonnegative(),
  autonomyIterationCount: z.number().int().nonnegative(),
  autonomyMaxIterations: z.number().int().positive(),
  updatedAt: isoDateTime,
});
export type Task = z.infer<typeof taskSchema>;

export const createTaskRequestSchema = z.object({
  loop: requiredString(`loop is required.`).pipe(uuid()),
  resumeTaskId: uuid().optional(),
  sourceType: z.enum(taskSourceTypes),
  description: requiredString(`description is required.`),
  sourceRef: normalizedString,
  kind: z.enum(taskKinds).optional(),
  ownerMode: z.enum(taskOwnerModes).optional(),
  successCriteria: z.array(z.string()).optional(),
  externalRefs: z.array(z.string()).optional(),
  assignedPersona: uuid().optional(),
  approvals: taskApprovalsSchema.optional(),
  payload: taskPayloadSchema.optional(),
});

export const validatedCreateTaskRequestSchema = createTaskRequestSchema.extend({
  approvals: taskApprovalsSchema.default([]),
  payload: taskPayloadSchema.default({ timeline: [] }),
  kind: z.enum(taskKinds).default(`other`),
  ownerMode: z.enum(taskOwnerModes).default(`mixed`),
  successCriteria: z.array(z.string()).default([]),
  externalRefs: z.array(z.string()).default([]),
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;
export type ValidatedCreateTaskRequest = z.infer<typeof validatedCreateTaskRequestSchema>;

export const createTaskResponseSchema = z.object({
  loop: loopSchema,
  tasks: z.array(taskSchema),
  routeDecision: routeDecisionSchema.optional(),
});
export type CreateTaskResponse = z.infer<typeof createTaskResponseSchema>;

export const routingProviderConnectionSchemaWithMeta = routingProviderConnectionSchema;

export const routingModelChoiceSchemaExtended = routingLlmRouteDecisionSchema.pick({
  selectedModel: true,
  routeReasonText: true,
});

export const markTaskCompletedRequestSchema = z.object({
  loop: uuid(),
  taskId: uuid().optional(),
  note: z.string().optional(),
});

export const markTaskBlockedRequestSchema = z.object({
  loop: uuid(),
  taskId: uuid().optional(),
  blocker: requiredString(`blocker is required.`),
  note: z.string().optional(),
});

export const updateTaskContextRequestSchema = z.object({
  loop: uuid(),
  taskId: uuid().optional(),
  context: requiredString(`context is required.`),
  note: z.string().optional(),
});

export type MarkTaskCompletedRequest = z.infer<typeof markTaskCompletedRequestSchema>;
export type MarkTaskBlockedRequest = z.infer<typeof markTaskBlockedRequestSchema>;
export type UpdateTaskContextRequest = z.infer<typeof updateTaskContextRequestSchema>;

export const taskInsertSchema = taskSchema.omit({
  id: true,
  emittedAt: true,
  updatedAt: true,
  claimToken: true,
  claimOwner: true,
  pingedAt: true,
  processingSourceStatus: true,
  claimAttemptCount: true,
});
export type TaskInsert = z.infer<typeof taskInsertSchema>;

const taskUpdateMutableSchema = taskSchema.pick({
  phase: true,
  status: true,
  assignee: true,
  selectedPersona: true,
  targetType: true,
  targetId: true,
  routeReasonCode: true,
  routeReasonText: true,
  blocker: true,
  payload: true,
  context: true,
  routing: true,
  completedAt: true,
  autonomyIterationCount: true,
  autonomyMaxIterations: true,
});

export const taskUpdateInputSchema = z
  .object({
    id: taskSchema.shape.id,
    expectedClaimToken: uuid().optional(),
    clearClaim: z.boolean().optional(),
  })
  .extend({
    ...taskUpdateMutableSchema.partial().shape,
  });
export type TaskUpdateInput = z.infer<typeof taskUpdateInputSchema>;

export const loopPersonaRoutedResultSchema = z.object({
  status: z.literal(`routed`),
  assignee: uuid(),
  note: z.string(),
});
export type LoopPersonaRoutedResult = z.infer<typeof loopPersonaRoutedResultSchema>;

export const loopPersonaCompletedResultSchema = z.object({
  status: z.literal(`completed`),
  note: z.string(),
});
export type LoopPersonaCompletedResult = z.infer<typeof loopPersonaCompletedResultSchema>;

export const loopPersonaBlockedResultSchema = z.object({
  status: z.literal(`blocked`),
  blocker: z.string(),
  note: z.string(),
});
export type LoopPersonaBlockedResult = z.infer<typeof loopPersonaBlockedResultSchema>;

export const loopPersonaResultSchema = z.union([loopPersonaRoutedResultSchema, loopPersonaCompletedResultSchema, loopPersonaBlockedResultSchema]);
export type LoopPersonaResult = z.infer<typeof loopPersonaResultSchema>;

export type LoopPersonaHandler = {
  persona: PersonaId;
  handle: (task: Task) => LoopPersonaResult;
};

export const routingTaskContextSchema = z.object({
  request: validatedCreateTaskRequestSchema,
  sourcePayload: taskPayloadSchema,
  sourceRef: z.string().optional(),
});
export type RoutingTaskContext = z.infer<typeof routingTaskContextSchema>;
