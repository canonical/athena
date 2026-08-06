import { loopSchema } from "@components/loop/loop.schema.js";
import type { PersonaId } from "@components/persona/persona.schema.js";

import { providerModelSchema } from "@components/provider/provider.schema.js";
import { isoDateTime, normalizedString, requiredString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

// ============================================================================
// SECTION 1: ENUMS AND CONSTANTS
// ============================================================================

export const taskPhases = [`routing`, `execution`, `done`] as const;
export type TaskPhase = (typeof taskPhases)[number];

export const taskStatuses = [`active`, `queued`, `processing`, `requires-user-input`, `requires-user-approval`, `completed`, `blocked`, `pool-not-ready`] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const taskSourceTypes = [`chat-ui`, `workgraph-webhook`] as const;
export type TaskSourceType = (typeof taskSourceTypes)[number];

export const taskExecutionLanes = [`provider-based`, `runner-based`] as const;
export type TaskExecutionLane = (typeof taskExecutionLanes)[number];

export const taskKindDefinitions = [
  { kind: `coding`, requiredExecutionLane: `runner-based` },
  { kind: `jira-refinement`, requiredExecutionLane: `provider-based` },
  { kind: `analysis`, requiredExecutionLane: `provider-based` },
  { kind: `design`, requiredExecutionLane: `provider-based` },
  { kind: `research`, requiredExecutionLane: `provider-based` },
  { kind: `other`, requiredExecutionLane: `provider-based` },
] as const satisfies ReadonlyArray<{ kind: string; requiredExecutionLane: TaskExecutionLane }>;

export const taskKinds = taskKindDefinitions.map((definition) => definition.kind) as unknown as readonly [
  (typeof taskKindDefinitions)[number][`kind`],
  ...Array<(typeof taskKindDefinitions)[number][`kind`]>,
];
export type TaskKind = (typeof taskKinds)[number];

export const taskKindSchema = z.enum(taskKinds);
export const taskExecutionLaneSchema = z.enum(taskExecutionLanes);

export const routeReasonCodes = [`ROUTED_FROM_FIRST_MESSAGE`, `ROUTED_FROM_CONVERSATION_CONTEXT`, `REUSED_PREVIOUS_SELECTION`, `MANUAL_OVERRIDE`] as const;
export type RouteReasonCode = (typeof routeReasonCodes)[number];

export const timelineEntryTypes = [`task-created`, `chat-session`, `routing-decision`, `llm-call`, `system-action-started`, `system-action-result`, `waiting-user-input`, `user-approval`, `task-completed`, `task-blocked`] as const;
export type TimelineEntryType = (typeof timelineEntryTypes)[number];

// ============================================================================
// SECTION 2: FOUNDATIONAL PAYLOAD SCHEMAS
// ============================================================================

export const taskChatPayloadSchema = z.object({
  messageType: z.enum([`user`, `assistant`, `system`]).optional(),
  message: z.string(),
  channel: z.string().optional(),
});
export type TaskChatPayload = z.infer<typeof taskChatPayloadSchema>;

export const taskRoutingPayloadSchema = z.object({
  selectedPersona: uuid().optional(),
  selectedPersonaDisplayName: z.string().optional(),
  selectedModel: z.string().optional(),
  taskKind: taskKindSchema.optional(),
  blockedModels: z.array(z.string()).optional(),
  targetType: z.enum([`provider`, `runner`]).optional(),
  executionLane: taskExecutionLaneSchema.optional(),
  requiredExecutionLane: taskExecutionLaneSchema.optional(),
  conversationMode: z.string().optional(),
  routeReasonCode: z.string().optional(),
  routeReasonText: z.string().optional(),
});
export type TaskRoutingPayload = z.infer<typeof taskRoutingPayloadSchema>;

export const taskRoutingMetaSchema = z.object({
  routeAttempts: z.number().int().nonnegative(),
  lastRoutedAt: isoDateTime.nullable(),
  lastRoutedByPersona: uuid().nullable(),
  lastRouteReasonCode: z.string().nullable(),
});
export type TaskRoutingMeta = z.infer<typeof taskRoutingMetaSchema>;

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

export const pendingToolApprovalToolCallSchema = z.object({
  id: z.string().min(1),
  tool: z.string().min(1),
  input: z.record(z.string(), z.unknown()).optional(),
  rawArguments: z.string().optional(),
});
export type PendingToolApprovalToolCall = z.infer<typeof pendingToolApprovalToolCallSchema>;

export const pendingToolApprovalRequestSchema = z.object({
  requestId: uuid(),
  createdAt: isoDateTime,
  approvalType: z.literal(`tool-call`),
  approvalFingerprint: z.string().min(1),
  selectedPersona: uuid().nullable(),
  selectedPersonaDisplayName: z.string().nullable(),
  selectedModel: z.string().nullable(),
  requestedTools: z.array(z.string().min(1)).min(1),
  toolCall: pendingToolApprovalToolCallSchema,
  assistantResponseText: z.string().optional(),
  approvalDescription: z.string().optional(), // Human-readable description of what this tool call will do
});
export type PendingToolApprovalRequest = z.infer<typeof pendingToolApprovalRequestSchema>;

export const taskApprovalDecisionSchema = z.object({
  decision: z.enum([`approved`, `rejected`]),
  requestId: uuid(),
  message: normalizedString,
});
export type TaskApprovalDecision = z.infer<typeof taskApprovalDecisionSchema>;

export const workgraphItemPayloadSchema = z.object({
  id: uuid().optional(),
  itemKey: z.string().min(1),
  labels: z.array(z.string()),
});
export type WorkgraphItemPayload = z.infer<typeof workgraphItemPayloadSchema>;

export const taskApprovalsSchema = z.array(z.unknown());
export type TaskApprovals = z.infer<typeof taskApprovalsSchema>;

// Composite payload schema that combines all payload sub-structures
export const taskPayloadSchema = z
  .object({
    channel: z.string().optional(),
    chat: taskChatPayloadSchema.optional(),
    routing: taskRoutingPayloadSchema.optional(),
    pendingToolApprovalRequest: pendingToolApprovalRequestSchema.nullable().optional(),
    timeline: z.array(timelineEntrySchema).default([]),
    workgraphItem: workgraphItemPayloadSchema.optional(),
  })
  .loose();
export type TaskPayload = z.infer<typeof taskPayloadSchema>;

// ============================================================================
// SECTION 3: CANONICAL TASK SCHEMA
// ============================================================================
// This is the SINGLE SOURCE OF TRUTH for task data shape.
// All derived schemas reference this schema using .shape, .pick(), or .omit()
// to prevent drift.

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
  workgraphItem: uuid().nullable().optional(),
  routeReasonCode: z.string().nullable(),
  routeReasonText: z.string().nullable(),
  // Work definition (formerly split between requestedOutcome and task.objective)
  description: z.string().nullable(),
  kind: taskKindSchema,
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
  llmCostUsdTotal: z.number().nonnegative(),
  updatedAt: isoDateTime,
});
export type Task = z.infer<typeof taskSchema>;

// ============================================================================
// SECTION 4: DERIVED SCHEMAS FROM taskSchema
// ============================================================================
// All schemas in this section derive from taskSchema to ensure consistency.
// No duplicate field definitions — everything uses .shape, .pick(), or .omit()

// --- Database Operation Schemas ---

// Insertion schema — omits all auto-generated/computed fields
// This is the shape passed to INSERT operations
export const taskInsertSchema = taskSchema.omit({
  id: true,
  emittedAt: true,
  updatedAt: true,
  claimToken: true,
  claimOwner: true,
  pingedAt: true,
  processingSourceStatus: true,
  claimAttemptCount: true,
  llmCostUsdTotal: true,
});
export type TaskInsert = z.infer<typeof taskInsertSchema>;

// Create input schema — derived from taskInsert, kind is set during routing decision
// This is what queryTaskCreate accepts
export const taskCreateInputSchema = taskInsertSchema.omit({
  kind: true,
});
export type TaskCreateInput = z.infer<typeof taskCreateInputSchema>;

// Define which task fields are mutable during updates
const taskUpdateMutableSchema = taskSchema.pick({
  phase: true,
  status: true,
  assignee: true,
  selectedPersona: true,
  targetType: true,
  targetId: true,
  routeReasonCode: true,
  routeReasonText: true,
  kind: true,
  blocker: true,
  payload: true,
  context: true,
  routing: true,
  completedAt: true,
  autonomyIterationCount: true,
  autonomyMaxIterations: true,
  llmCostUsdTotal: true,
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

// --- User Request Schemas ---

// Create request schema derived from taskSchema fields + resume/approval extensions
export const createTaskRequestSchema = z.object({
  loop: requiredString(`loop is required.`).pipe(uuid()),
  sourceType: taskSchema.shape.sourceType,
  sourceRef: normalizedString,
  description: requiredString(`description is required.`),
  successCriteria: taskSchema.shape.successCriteria.optional(),
  externalRefs: taskSchema.shape.externalRefs.optional(),
  approvals: taskSchema.shape.approvals.optional(),
  payload: taskSchema.shape.payload.optional(),
  // Resume task extensions
  resumeTaskId: uuid().optional(),
  approvalDecision: taskApprovalDecisionSchema.optional(),
});

// Validated version with defaults — all derived from taskSchema defaults
export const validatedCreateTaskRequestSchema = createTaskRequestSchema.extend({
  approvals: taskSchema.shape.approvals.default([]),
  payload: taskSchema.shape.payload.default({ timeline: [] }),
  successCriteria: taskSchema.shape.successCriteria.default([]),
  externalRefs: taskSchema.shape.externalRefs.default([]),
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;
export type ValidatedCreateTaskRequest = z.infer<typeof validatedCreateTaskRequestSchema>;

// ============================================================================
// SECTION 4b: ROUTING AND DECISION SCHEMAS (MUST BE BEFORE createTaskResponseSchema)
// ============================================================================
// These define the routing/decision data structures (used by createTaskResponseSchema)

export const routeDecisionSchema = z.object({
  selectedPersona: uuid(),
  selectedModel: z.string().optional(),
  targetType: z.enum([`provider`, `runner`]),
  taskKind: taskKindSchema,
  routeReasonCode: z.enum(routeReasonCodes),
  routeReasonText: z.string(),
});
export type RouteDecision = z.infer<typeof routeDecisionSchema>;

export const routingLlmRouteDecisionSchema = z.object({
  selectedPersona: uuid(),
  selectedModel: z.string().optional(),
  targetType: z.enum([`provider`, `runner`]),
  taskKind: taskKindSchema,
  routeReasonText: z.string(),
});
export type RoutingLlmRouteDecision = z.infer<typeof routingLlmRouteDecisionSchema>;

// Response schema for task creation
export const createTaskResponseSchema = z.object({
  loop: loopSchema,
  tasks: z.array(taskSchema),
  routeDecision: routeDecisionSchema.optional(),
});
export type CreateTaskResponse = z.infer<typeof createTaskResponseSchema>;

// Task operation schemas — derived from taskSchema.shape
export const markTaskCompletedRequestSchema = z.object({
  loop: taskSchema.shape.loop,
  taskId: uuid().optional(),
  note: z.string().optional(),
});

export const markTaskBlockedRequestSchema = z.object({
  loop: taskSchema.shape.loop,
  taskId: uuid().optional(),
  blocker: requiredString(`blocker is required.`),
  note: z.string().optional(),
});

export const updateTaskContextRequestSchema = z.object({
  loop: taskSchema.shape.loop,
  taskId: uuid().optional(),
  context: requiredString(`context is required.`),
  note: z.string().optional(),
});

export type MarkTaskCompletedRequest = z.infer<typeof markTaskCompletedRequestSchema>;
export type MarkTaskBlockedRequest = z.infer<typeof markTaskBlockedRequestSchema>;
export type UpdateTaskContextRequest = z.infer<typeof updateTaskContextRequestSchema>;

// Routing context — uses payload shape from taskSchema
export const routingTaskContextSchema = z.object({
  request: validatedCreateTaskRequestSchema,
  sourcePayload: taskSchema.shape.payload,
  sourceRef: z.string().optional(),
});
export type RoutingTaskContext = z.infer<typeof routingTaskContextSchema>;

// ============================================================================
// SECTION 5: ROUTING AND DECISION SUPPORT SCHEMAS
// ============================================================================
// Additional routing-related type definitions and utilities

export type RoutingChoiceAttempt<T> = {
  choice: T | null;
  auditEntry: TimelineEntry;
  error: Error | null;
};

export type RoutingDecisionChoiceAttempt = RoutingChoiceAttempt<RoutingLlmRouteDecision> & {
  conversationMode: string;
  llmCostUsd: number;
};

export type RouteDecisionAttempt = {
  routeDecision: RouteDecision | null;
  llmTimelineEntries: TimelineEntry[];
  conversationMode: string | null;
  error: Error | null;
  llmCostUsd: number;
  blockedModels: string[];
};

export const routingProviderConnectionSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  routingModel: z.string(),
  defaultModel: z.string().nullable(),
  enabledModels: z.array(z.string()),
  availableModels: z.array(providerModelSchema),
});
export type RoutingProviderConnection = z.infer<typeof routingProviderConnectionSchema>;

export const routingProviderConnectionSchemaWithMeta = routingProviderConnectionSchema;

export const routingModelChoiceSchemaExtended = routingLlmRouteDecisionSchema.pick({
  selectedModel: true,
  routeReasonText: true,
});

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

// ============================================================================
// SECTION 6: PERSONA RESULT SCHEMAS
// ============================================================================

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
