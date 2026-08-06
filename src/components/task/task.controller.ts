import { evaluateLoopReadiness } from "@components/loop/loop.readiness.js";
import { queryLoopById, queryLoopDisabledProviderToolsById, queryLoopForUser, queryLoopReadinessCounts } from "@components/loop/loop.service.js";
import { resolveLoopSelection, resolveLoopSelectionByAssignment } from "@components/loop/loop-selection.service.js";
import {
  fetchOpenRouterChatCompletion,
  fetchOpenRouterModels,
  OpenRouterRequestError,
  parseOpenRouterFirstChoiceJsonObject,
  readOpenRouterAssistantText,
  readOpenRouterUsageCostUsd,
  validateOpenRouterModel,
} from "@components/openrouter/openrouter.service.js";
import type { Persona } from "@components/persona/persona.schema.js";
import { queryLoopPersonaList } from "@components/persona/persona.service.js";
import type { ProviderModel } from "@components/provider/provider.schema.js";
import { enabledProviderToolNamesFromDisabled } from "@components/tool/tool.catalog.js";
import { buildProcessScopedOwner } from "@components/utilities/process-identity.js";
import { v7 as uuidv7 } from "uuid";
import { TaskAccessError, TaskClaimLostError, TaskConflictError, TaskValidationError } from "./task.errors.js";
import { executeTaskTarget, type TaskExecutionResult } from "./task.execution.js";
import { type ExecutionLane, executionLaneForTargetType, resolveRequiredExecutionLaneForTaskKind, taskKindRequirementCatalog } from "./task.execution-lane.js";
import { buildRoutingConversationContext, buildTaskOpenRouterSessionId } from "./task.history.js";
import type {
  CreateTaskResponse,
  RouteDecisionAttempt,
  RoutingDecisionChoiceAttempt,
  RoutingProviderConnection,
  Task,
  TaskKind,
  TaskPayload,
  TaskRoutingMeta,
  TimelineEntry,
  TimelineEntryType,
  ValidatedCreateTaskRequest,
} from "./task.schema.js";
import { taskKinds } from "./task.schema.js";
import {
  queryLoopLatestTask,
  queryLoopsWithPoolNotReadyTasks,
  queryLoopTaskList,
  queryNextProcessableTask,
  queryPromotePoolNotReadyTasksToQueued,
  queryTaskById,
  queryTaskCreate,
  queryTaskList,
  queryTaskPing,
  queryTaskUpdate,
} from "./task.service.js";

const queueClaimOwner = buildProcessScopedOwner(`athena-worker`);
const defaultAutonomyMaxIterations = 5;

const toFixedUsd = (value: number): string => value.toFixed(6);

const addUsdCost = (current: number, delta: number): number => {
  const next = current + delta;
  return Number.isFinite(next) && next >= 0 ? next : current;
};

const readLoopIterationCostLimitUsd = async (loopId: string): Promise<number | null> => {
  const loop = await queryLoopById(loopId);
  return loop?.iterationCostLimitUsd ?? null;
};

const readLoopEnabledProviderToolNames = async (loopId: string): Promise<string[]> => {
  const disabledProviderTools = await queryLoopDisabledProviderToolsById(loopId);
  return enabledProviderToolNamesFromDisabled(disabledProviderTools);
};

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== `string`) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === `object` && !Array.isArray(value);

const readPendingToolApprovalRequest = (task: Task): TaskPayload[`pendingToolApprovalRequest`] => task.payload.pendingToolApprovalRequest ?? null;

const buildRoutingPersonaSystemPrompt = (routingPersona: Persona): string =>
  [
    `You are ${routingPersona.displayName}.`,
    routingPersona.role ? `Role: ${routingPersona.role}.` : null,
    `Personality guidance: ${routingPersona.personality}`,
    `You are the routing persona for this loop and must produce strict JSON outputs only.`,
    `Never include markdown, code fences, or text outside the requested JSON object.`,
  ]
    .filter(Boolean)
    .join(`\n`);

const makeTimelineEntry = (type: TimelineEntryType, actor: string, data: Record<string, unknown>): TimelineEntry => ({
  id: uuidv7(),
  timestamp: new Date().toISOString(),
  type,
  actor,
  data,
});

const makeLlmCallTimelineEntry = (actor: string, data: Record<string, unknown>): TimelineEntry => makeTimelineEntry(`llm-call`, actor, data);

const appendTimelineEntry = (payload: TaskPayload, entry: TimelineEntry): TaskPayload => {
  const timeline = Array.isArray(payload.timeline) ? payload.timeline : [];

  return {
    ...payload,
    timeline: [...timeline, entry],
  };
};

const appendTimelineEntries = (payload: TaskPayload, entries: TimelineEntry[]): TaskPayload => entries.reduce((nextPayload, entry) => appendTimelineEntry(nextPayload, entry), payload);

const withRoutingResponder = (payload: TaskPayload, routingPersona: Persona): TaskPayload => ({
  ...payload,
  routing: {
    ...payload.routing,
    selectedPersona: routingPersona.id,
    selectedPersonaDisplayName: routingPersona.displayName,
  },
});

const readTaskBlockedModels = (payload: TaskPayload): string[] => {
  const blocked = payload.routing?.blockedModels;

  if (!Array.isArray(blocked)) {
    return [];
  }

  return Array.from(new Set(blocked.map((value) => value.trim()).filter((value) => value.length > 0)));
};

const appendTaskBlockedModel = (payload: TaskPayload, modelId: string): TaskPayload => {
  const normalized = modelId.trim();

  if (normalized.length === 0) {
    return payload;
  }

  const blockedModels = Array.from(new Set([...readTaskBlockedModels(payload), normalized]));

  return {
    ...payload,
    routing: {
      ...payload.routing,
      blockedModels,
    },
  };
};

const readProviderModel404Failure = (executionResult: TaskExecutionResult): { model: string; reason: string } | null => {
  const timelineEntries = executionResult.llmTimelineEntries ?? [];

  for (let index = timelineEntries.length - 1; index >= 0; index -= 1) {
    const entry = timelineEntries[index];

    if (entry?.type !== `llm-call`) {
      continue;
    }

    const errorStatus = typeof entry.data.errorStatus === `number` ? entry.data.errorStatus : null;
    const model = typeof entry.data.model === `string` ? entry.data.model.trim() : ``;

    if (errorStatus === 404 && model.length > 0) {
      const reason = typeof entry.data.errorMessage === `string` && entry.data.errorMessage.trim().length > 0 ? entry.data.errorMessage : executionResult.output;

      return { model, reason };
    }
  }

  return null;
};

const getActiveRoutingPersona = (personas: Persona[]): Persona => {
  const routingPersonas = personas.filter((persona) => persona.isRouting);

  if (routingPersonas.length !== 1) {
    throw new TaskValidationError(`This loop must have exactly one active routing persona.`);
  }

  return routingPersonas[0] as Persona;
};

const getExecutionCandidates = (personas: Persona[]): Persona[] => {
  const executionCandidates = personas;

  return executionCandidates;
};

const buildAvailableRoutingModels = (enabledModelIds: string[], models: ProviderModel[]): ProviderModel[] => {
  const uniqueEnabledModelIds = Array.from(new Set(enabledModelIds.map((model) => model.trim()).filter((model) => model.length > 0)));
  const catalog = new Map(models.map((model) => [model.id, model]));

  return uniqueEnabledModelIds.map((modelId) => catalog.get(modelId) ?? { id: modelId, displayName: modelId });
};

const buildRoutingModelPromptCatalog = (models: ProviderModel[]): Array<Record<string, unknown>> =>
  models.map((model) => ({
    id: model.id,
    displayName: model.displayName,
    description: model.description,
    contextLength: model.contextLength,
    maxCompletionTokens: model.maxCompletionTokens,
    modality: model.modality,
    inputModalities: model.inputModalities,
    outputModalities: model.outputModalities,
    supportedParameters: model.supportedParameters,
    pricing: {
      prompt: model.promptPrice,
      completion: model.completionPrice,
      request: model.requestPrice,
      image: model.imagePrice,
    },
    knowledgeCutoff: model.knowledgeCutoff,
    reasoningSupported: model.reasoningSupported,
    reasoningEfforts: model.reasoningEfforts,
  }));

const buildRoutingLlmMessages = (systemPrompt: string, userPrompt: string): Array<{ role: `system` | `user`; content: string }> => [
  {
    role: `system`,
    content: systemPrompt,
  },
  {
    role: `user`,
    content: userPrompt,
  },
];

const withLlmAuditValidationFailure = (entry: TimelineEntry, errorMessage: string): TimelineEntry => ({
  ...entry,
  data: {
    ...entry.data,
    status: `invalid-response`,
    errorMessage,
  },
});

const executeRoutingLlmCall = async (
  connection: RoutingProviderConnection,
  routingPersona: Persona,
  taskId: string,
  operation: string,
  systemPrompt: string,
  userPrompt: string,
  iterationCostLimitUsd: number | null,
): Promise<{ parsed: Record<string, unknown> | null; auditEntry: TimelineEntry; error: Error | null; callCostUsd: number }> => {
  const messages = buildRoutingLlmMessages(systemPrompt, userPrompt);

  try {
    const payload = await fetchOpenRouterChatCompletion(
      {
        baseUrl: connection.baseUrl,
        apiKey: connection.apiKey,
      },
      {
        model: connection.routingModel,
        temperature: 0,
        sessionId: buildTaskOpenRouterSessionId(taskId, `routing`),
        operation,
        messages,
      },
    );
    const responseText = readOpenRouterAssistantText(payload.choices?.[0]?.message).trim();
    const callCostUsd = readOpenRouterUsageCostUsd(payload) ?? 0;

    if (iterationCostLimitUsd !== null && callCostUsd > iterationCostLimitUsd) {
      return {
        parsed: null,
        auditEntry: makeLlmCallTimelineEntry(routingPersona.displayName, {
          operation,
          status: `cost-limit-exceeded`,
          providerType: `openrouter`,
          model: connection.routingModel,
          messages,
          responseText,
          responsePayload: payload,
          usageCostUsd: callCostUsd,
          iterationCostLimitUsd,
          errorMessage: `Routing iteration cost limit exceeded after this LLM call.`,
        }),
        error: new TaskConflictError(`Routing iteration cost exceeded loop limit. Actual: $${toFixedUsd(callCostUsd)} Limit: $${toFixedUsd(iterationCostLimitUsd)}.`),
        callCostUsd,
      };
    }

    try {
      const parsed = parseOpenRouterFirstChoiceJsonObject(payload, `Routing persona response`);

      return {
        parsed,
        auditEntry: makeLlmCallTimelineEntry(routingPersona.displayName, {
          operation,
          status: `completed`,
          providerType: `openrouter`,
          model: connection.routingModel,
          messages,
          usageCostUsd: callCostUsd,
          iterationCostLimitUsd,
          responseText,
          responsePayload: payload,
          parsedResponse: parsed,
        }),
        error: null,
        callCostUsd,
      };
    } catch (error) {
      return {
        parsed: null,
        auditEntry: makeLlmCallTimelineEntry(routingPersona.displayName, {
          operation,
          status: `invalid-response`,
          providerType: `openrouter`,
          model: connection.routingModel,
          messages,
          usageCostUsd: callCostUsd,
          iterationCostLimitUsd,
          responseText,
          responsePayload: payload,
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
        error: error instanceof Error ? error : new Error(String(error)),
        callCostUsd,
      };
    }
  } catch (error) {
    return {
      parsed: null,
      auditEntry: makeLlmCallTimelineEntry(routingPersona.displayName, {
        operation,
        status: `failed`,
        providerType: `openrouter`,
        model: connection.routingModel,
        messages,
        usageCostUsd: 0,
        iterationCostLimitUsd,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStatus: error instanceof OpenRouterRequestError ? error.status : undefined,
        errorPayload: error instanceof OpenRouterRequestError ? error.payload : undefined,
      }),
      error: error instanceof Error ? error : new Error(String(error)),
      callCostUsd: 0,
    };
  }
};

const validateRoutingSelectedProviderModel = async (
  connection: RoutingProviderConnection,
  routingPersona: Persona,
  taskId: string,
  selectedModel: string,
): Promise<{ available: boolean; auditEntry: TimelineEntry; error: Error | null; callCostUsd: number }> => {
  const messages = [{ role: `user` as const, content: `.` }];

  try {
    const validation = await validateOpenRouterModel(
      {
        baseUrl: connection.baseUrl,
        apiKey: connection.apiKey,
      },
      {
        model: selectedModel,
        operation: `routing-model-validation`,
        sessionId: buildTaskOpenRouterSessionId(taskId, `routing`),
        timeoutMs: 20_000,
      },
    );

    return {
      available: validation.available,
      auditEntry: makeLlmCallTimelineEntry(routingPersona.displayName, {
        operation: `routing-model-validation`,
        status: validation.available ? `completed` : validation.status === 404 ? `model-unavailable` : `failed`,
        providerType: `openrouter`,
        model: selectedModel,
        messages,
        responsePayload: validation.payload,
        usageCostUsd: validation.usageCostUsd,
        errorMessage: validation.reason,
        errorStatus: validation.status,
        errorPayload: validation.error?.payload,
      }),
      error: validation.error,
      callCostUsd: validation.usageCostUsd,
    };
  } catch (error) {
    return {
      available: false,
      auditEntry: makeLlmCallTimelineEntry(routingPersona.displayName, {
        operation: `routing-model-validation`,
        status: `failed`,
        providerType: `openrouter`,
        model: selectedModel,
        messages,
        usageCostUsd: 0,
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
      error: error instanceof Error ? error : new Error(String(error)),
      callCostUsd: 0,
    };
  }
};

const resolveProviderDefaultModel = async (loopId: string, targetId?: string | null): Promise<string> => {
  if (targetId) {
    const stickySelection = await resolveLoopSelectionByAssignment(loopId, `provider`, targetId);
    const stickyDefaultModel = normalizeString(stickySelection.selected?.defaultModel);

    if (stickyDefaultModel) {
      return stickyDefaultModel;
    }
  }

  const selection = await resolveLoopSelection(loopId, `provider`);
  const selectedDefaultModel = normalizeString(selection.selected?.defaultModel);

  if (!selectedDefaultModel) {
    throw new TaskConflictError(`Provider defaultModel is required for routing decisions.`);
  }

  return selectedDefaultModel;
};

const resolveRoutingProviderConnection = async (loopId: string, excludedModelIds: string[] = []): Promise<RoutingProviderConnection> => {
  const selection = await resolveLoopSelection(loopId, `provider`);
  const selected = selection.selected;

  if (selected?.definitionType !== `openrouter`) {
    throw new TaskConflictError(`No eligible OpenRouter provider assignment is available for routing.`);
  }

  const blockedModelIds = new Set(excludedModelIds.map((model) => model.trim()).filter((model) => model.length > 0));
  const enabledModels = selected.enabledModels.filter((model) => model.trim().length > 0 && !blockedModelIds.has(model));
  const preferredDefaultModel = normalizeString(selected.defaultModel);
  const routingModel = preferredDefaultModel && !blockedModelIds.has(preferredDefaultModel) ? preferredDefaultModel : enabledModels[0];

  if (!routingModel) {
    throw new TaskConflictError(`No eligible provider model is available for routing after excluding task-blocked models.`);
  }

  const availableModels = buildAvailableRoutingModels(
    enabledModels,
    await fetchOpenRouterModels({
      baseUrl: selected.baseUrl ?? `https://openrouter.ai/api/v1`,
      apiKey: selected.secret,
    }),
  );

  return {
    baseUrl: selected.baseUrl ?? `https://openrouter.ai/api/v1`,
    apiKey: selected.secret,
    routingModel,
    defaultModel: selected.defaultModel,
    enabledModels,
    availableModels,
  };
};

const resolveRouteDecisionByLlm = async (connection: RoutingProviderConnection, routingPersona: Persona, personas: Persona[], task: Task, iterationCostLimitUsd: number | null): Promise<RoutingDecisionChoiceAttempt> => {
  const personasForPrompt = personas.map((persona) => ({
    id: persona.id,
    displayName: persona.displayName,
    role: persona.role,
    personality: persona.personality,
    isRouting: persona.isRouting,
  }));
  const availableModels = buildAvailableRoutingModels(connection.enabledModels, connection.availableModels);
  const availableModelIds = availableModels.map((model) => model.id);
  const counts = await queryLoopReadinessCounts(task.loop);
  const routingContext = buildRoutingConversationContext(task);
  const systemPrompt = buildRoutingPersonaSystemPrompt(routingPersona);
  const userPrompt = [
    `Make exactly one routing decision for this task.`,
    `Decide taskKind, selectedPersona, selectedModel, and targetType together from the same conversation context.`,
    `Use the requested outcome, accumulated context, available personas, available models, and execution pools to decide who should handle this next and whether it belongs on provider autonomy or an external runner.`,
    `Assigned personas JSON: ${JSON.stringify(personasForPrompt)}`,
    `Available models JSON: ${JSON.stringify(buildRoutingModelPromptCatalog(availableModels))}`,
    `Available execution pool counts JSON: ${JSON.stringify({ provider: counts.activeProviderCount, runner: counts.activeRunnerCount })}`,
    `Task kind requirements JSON: ${JSON.stringify(taskKindRequirementCatalog)}`,
    `Current task description: ${task.description ?? `none`}`,
    `Current stored task kind: ${task.kind}`,
    `Current task context: ${task.context}`,
    `Conversation mode: ${routingContext.mode}`,
    `Conversation summary: ${routingContext.summary}`,
    `Conversation transcript before latest user message:\n${routingContext.transcript}`,
    `Latest user message: ${routingContext.latestUserMessage}`,
    `Choose taskKind first. The selected taskKind determines the required execution lane.`,
    `Choose runner when the work should be performed by an external runner. Choose provider when it should be handled directly through provider autonomy.`,
    `You must choose targetType that matches the required lane for the selected taskKind.`,
    `Choose a model from available models when provider-based execution is selected.`,
    `Respond with strict JSON: {"taskKind":"<task-kind>","selectedPersona":"<persona-id>","selectedModel":"<model-id>","targetType":"<provider|runner>","routeReasonText":"<short reason>"}`,
  ].join(`\n`);
  const result = await executeRoutingLlmCall(connection, routingPersona, task.id, `routing-decision`, systemPrompt, userPrompt, iterationCostLimitUsd);

  if (!result.parsed) {
    return {
      choice: null,
      auditEntry: result.auditEntry,
      conversationMode: routingContext.mode,
      error: result.error,
      llmCostUsd: result.callCostUsd,
    };
  }

  const parsed = result.parsed;
  const taskKind = normalizeString(parsed.taskKind);
  const selectedPersona = normalizeString(parsed.selectedPersona);
  const selectedModel = normalizeString(parsed.selectedModel);
  const targetType = parsed.targetType === `provider` || parsed.targetType === `runner` ? parsed.targetType : null;
  const routeReasonText = normalizeString(parsed.routeReasonText);

  if (!taskKind || !taskKinds.includes(taskKind as TaskKind)) {
    return {
      choice: null,
      auditEntry: withLlmAuditValidationFailure(result.auditEntry, `Routing persona response is missing or invalid taskKind.`),
      conversationMode: routingContext.mode,
      error: new TaskValidationError(`Routing persona response is missing or invalid taskKind.`),
      llmCostUsd: result.callCostUsd,
    };
  }

  if (!selectedPersona) {
    return {
      choice: null,
      auditEntry: withLlmAuditValidationFailure(result.auditEntry, `Routing persona response is missing selectedPersona.`),
      conversationMode: routingContext.mode,
      error: new TaskValidationError(`Routing persona response is missing selectedPersona.`),
      llmCostUsd: result.callCostUsd,
    };
  }

  if (!personas.some((persona) => persona.id === selectedPersona)) {
    return {
      choice: null,
      auditEntry: withLlmAuditValidationFailure(result.auditEntry, `Routing persona selected an unknown persona.`),
      conversationMode: routingContext.mode,
      error: new TaskValidationError(`Routing persona selected an unknown persona.`),
      llmCostUsd: result.callCostUsd,
    };
  }

  if (targetType === `provider` && !selectedModel) {
    return {
      choice: null,
      auditEntry: withLlmAuditValidationFailure(result.auditEntry, `Routing persona response is missing selectedModel.`),
      conversationMode: routingContext.mode,
      error: new TaskValidationError(`Routing persona response is missing selectedModel.`),
      llmCostUsd: result.callCostUsd,
    };
  }

  if (targetType === `provider` && selectedModel && availableModelIds.length > 0 && !availableModelIds.includes(selectedModel)) {
    return {
      choice: null,
      auditEntry: withLlmAuditValidationFailure(result.auditEntry, `Routing persona selected a model that is not in enabledModels.`),
      conversationMode: routingContext.mode,
      error: new TaskValidationError(`Routing persona selected a model that is not in enabledModels.`),
      llmCostUsd: result.callCostUsd,
    };
  }

  if (!targetType) {
    return {
      choice: null,
      auditEntry: withLlmAuditValidationFailure(result.auditEntry, `Routing persona response is missing targetType.`),
      conversationMode: routingContext.mode,
      error: new TaskValidationError(`Routing persona response is missing targetType.`),
      llmCostUsd: result.callCostUsd,
    };
  }

  return {
    choice: {
      taskKind: taskKind as TaskKind,
      selectedPersona,
      selectedModel: targetType === `provider` ? selectedModel : undefined,
      targetType,
      routeReasonText:
        routeReasonText ??
        (targetType === `provider`
          ? `${routingPersona.displayName} selected task kind ${taskKind}, persona ${selectedPersona}, model ${selectedModel}, and execution target ${targetType}.`
          : `${routingPersona.displayName} selected task kind ${taskKind}, persona ${selectedPersona}, and execution target ${targetType}.`),
    },
    auditEntry: result.auditEntry,
    conversationMode: routingContext.mode,
    error: null,
    llmCostUsd: result.callCostUsd,
  };
};

const resolveRouterDecisionForTask = async (task: Task, personas: Persona[], routingPersona: Persona, iterationCostLimitUsd: number | null): Promise<RouteDecisionAttempt> => {
  const llmTimelineEntries: TimelineEntry[] = [];
  const blockedModels = new Set(readTaskBlockedModels(task.payload));

  try {
    const candidates = getExecutionCandidates(personas);

    if (candidates.length === 0) {
      return {
        routeDecision: null,
        llmTimelineEntries,
        conversationMode: null,
        error: new TaskValidationError(`This loop has no active personas available for routing.`),
        llmCostUsd: 0,
        blockedModels: [...blockedModels],
      };
    }

    const maxRoutingAttempts = 5;
    let totalLlmCostUsd = 0;
    let lastConversationMode: string | null = null;

    for (let routingAttempt = 1; routingAttempt <= maxRoutingAttempts; routingAttempt += 1) {
      const routingConnection = await resolveRoutingProviderConnection(task.loop, [...blockedModels]);
      const llmRouteDecision = await resolveRouteDecisionByLlm(routingConnection, routingPersona, candidates, task, iterationCostLimitUsd);

      llmTimelineEntries.push(llmRouteDecision.auditEntry);
      totalLlmCostUsd = addUsdCost(totalLlmCostUsd, llmRouteDecision.llmCostUsd);
      lastConversationMode = llmRouteDecision.conversationMode;

      if (iterationCostLimitUsd !== null && totalLlmCostUsd > iterationCostLimitUsd) {
        llmTimelineEntries.push(
          makeTimelineEntry(`routing-decision`, routingPersona.displayName, {
            result: `routing-cost-limit-exceeded`,
            attempt: routingAttempt,
            actualCostUsd: totalLlmCostUsd,
            limitUsd: iterationCostLimitUsd,
          }),
        );

        return {
          routeDecision: null,
          llmTimelineEntries,
          conversationMode: llmRouteDecision.conversationMode,
          error: new TaskConflictError(`Routing iteration cost exceeded loop limit. Actual: $${toFixedUsd(totalLlmCostUsd)} Limit: $${toFixedUsd(iterationCostLimitUsd)}.`),
          llmCostUsd: totalLlmCostUsd,
          blockedModels: [...blockedModels],
        };
      }

      if (!llmRouteDecision.choice) {
        return {
          routeDecision: null,
          llmTimelineEntries,
          conversationMode: llmRouteDecision.conversationMode,
          error: llmRouteDecision.error,
          llmCostUsd: totalLlmCostUsd,
          blockedModels: [...blockedModels],
        };
      }

      if (llmRouteDecision.choice.targetType !== `provider`) {
        const selected = candidates.find((persona) => persona.id === llmRouteDecision.choice?.selectedPersona) ?? candidates[0] ?? routingPersona;

        return {
          routeDecision: {
            selectedPersona: selected.id,
            selectedModel: undefined,
            targetType: llmRouteDecision.choice.targetType,
            taskKind: llmRouteDecision.choice.taskKind,
            routeReasonCode: `ROUTED_FROM_CONVERSATION_CONTEXT`,
            routeReasonText: llmRouteDecision.choice.routeReasonText,
          },
          llmTimelineEntries,
          conversationMode: llmRouteDecision.conversationMode,
          error: null,
          llmCostUsd: totalLlmCostUsd,
          blockedModels: [...blockedModels],
        };
      }

      const selectedModel = llmRouteDecision.choice.selectedModel;

      if (!selectedModel) {
        return {
          routeDecision: null,
          llmTimelineEntries,
          conversationMode: llmRouteDecision.conversationMode,
          error: new TaskValidationError(`Routing persona response is missing selectedModel.`),
          llmCostUsd: totalLlmCostUsd,
          blockedModels: [...blockedModels],
        };
      }

      const validation = await validateRoutingSelectedProviderModel(routingConnection, routingPersona, task.id, selectedModel);
      llmTimelineEntries.push(validation.auditEntry);
      totalLlmCostUsd = addUsdCost(totalLlmCostUsd, validation.callCostUsd);

      if (iterationCostLimitUsd !== null && totalLlmCostUsd > iterationCostLimitUsd) {
        llmTimelineEntries.push(
          makeTimelineEntry(`routing-decision`, routingPersona.displayName, {
            result: `routing-cost-limit-exceeded`,
            attempt: routingAttempt,
            model: selectedModel,
            actualCostUsd: totalLlmCostUsd,
            limitUsd: iterationCostLimitUsd,
          }),
        );

        return {
          routeDecision: null,
          llmTimelineEntries,
          conversationMode: llmRouteDecision.conversationMode,
          error: new TaskConflictError(`Routing iteration cost exceeded loop limit. Actual: $${toFixedUsd(totalLlmCostUsd)} Limit: $${toFixedUsd(iterationCostLimitUsd)}.`),
          llmCostUsd: totalLlmCostUsd,
          blockedModels: [...blockedModels],
        };
      }

      if (validation.available) {
        const selected = candidates.find((persona) => persona.id === llmRouteDecision.choice?.selectedPersona) ?? candidates[0] ?? routingPersona;

        return {
          routeDecision: {
            selectedPersona: selected.id,
            selectedModel,
            targetType: `provider`,
            taskKind: llmRouteDecision.choice.taskKind,
            routeReasonCode: `ROUTED_FROM_CONVERSATION_CONTEXT`,
            routeReasonText: llmRouteDecision.choice.routeReasonText,
          },
          llmTimelineEntries,
          conversationMode: llmRouteDecision.conversationMode,
          error: null,
          llmCostUsd: totalLlmCostUsd,
          blockedModels: [...blockedModels],
        };
      }

      if (validation.error instanceof OpenRouterRequestError && validation.error.status === 404) {
        blockedModels.add(selectedModel);
        llmTimelineEntries.push(
          makeTimelineEntry(`routing-decision`, routingPersona.displayName, {
            result: `routing-model-unavailable-retry`,
            model: selectedModel,
            attempt: routingAttempt,
            reason: validation.error.payload.error?.message ?? validation.error.message,
          }),
        );
        continue;
      }

      return {
        routeDecision: null,
        llmTimelineEntries,
        conversationMode: llmRouteDecision.conversationMode,
        error: validation.error,
        llmCostUsd: totalLlmCostUsd,
        blockedModels: [...blockedModels],
      };
    }

    return {
      routeDecision: null,
      llmTimelineEntries,
      conversationMode: lastConversationMode,
      error: new TaskConflictError(`Routing exhausted retries because selected provider models were unavailable.`),
      llmCostUsd: totalLlmCostUsd,
      blockedModels: [...blockedModels],
    };
  } catch (error) {
    return {
      routeDecision: null,
      llmTimelineEntries,
      conversationMode: null,
      error: error instanceof Error ? error : new Error(String(error)),
      llmCostUsd: 0,
      blockedModels: [...blockedModels],
    };
  }
};

type TaskDefaults = { successCriteria: Task[`successCriteria`]; externalRefs: Task[`externalRefs`]; context: Task[`context`]; routing: TaskRoutingMeta };

const buildTaskDefaults = (request: ValidatedCreateTaskRequest): TaskDefaults => ({
  successCriteria: [],
  externalRefs: [],
  context: `Task created from ${request.sourceType}. Routing decision queued.`,
  routing: {
    routeAttempts: 0,
    lastRoutedAt: null,
    lastRoutedByPersona: null,
    lastRouteReasonCode: null,
  },
});

const withRoutingMetadata = (current: TaskRoutingMeta, routedByPersonaId: string, routeReasonCode: string): TaskRoutingMeta => ({
  routeAttempts: (current.routeAttempts ?? 0) + 1,
  lastRoutedAt: new Date().toISOString(),
  lastRoutedByPersona: routedByPersonaId,
  lastRouteReasonCode: routeReasonCode,
});

type ResolvedExecutionTarget = {
  targetType: `provider` | `runner` | null;
  targetId: string | null;
  definitionType: string | null;
  secret: string | null;
  baseUrl: string | null;
  defaultModel: string | null;
  enabledModels: string[];
};

const resolveExecutionTarget = async (loopId: string, preferredTargetType: `provider` | `runner`): Promise<ResolvedExecutionTarget> => {
  const preferredSelection = await resolveLoopSelection(loopId, preferredTargetType);

  if (preferredSelection.selected) {
    return {
      targetType: preferredTargetType,
      targetId: preferredSelection.selected.assignmentId,
      definitionType: preferredSelection.selected.definitionType,
      secret: preferredSelection.selected.secret,
      baseUrl: preferredSelection.selected.baseUrl,
      defaultModel: preferredSelection.selected.defaultModel,
      enabledModels: preferredSelection.selected.enabledModels,
    };
  }

  return {
    targetType: null,
    targetId: null,
    definitionType: null,
    secret: null,
    baseUrl: null,
    defaultModel: null,
    enabledModels: [],
  };
};

const resolveStickyExecutionTarget = async (task: Task): Promise<ResolvedExecutionTarget> => {
  if (!task.targetType || !task.targetId) {
    return {
      targetType: null,
      targetId: null,
      definitionType: null,
      secret: null,
      baseUrl: null,
      defaultModel: null,
      enabledModels: [],
    };
  }

  const stickySelection = await resolveLoopSelectionByAssignment(task.loop, task.targetType, task.targetId);

  if (!stickySelection.selected) {
    return {
      targetType: null,
      targetId: null,
      definitionType: null,
      secret: null,
      baseUrl: null,
      defaultModel: null,
      enabledModels: [],
    };
  }

  return {
    targetType: task.targetType,
    targetId: stickySelection.selected.assignmentId,
    definitionType: stickySelection.selected.definitionType,
    secret: stickySelection.selected.secret,
    baseUrl: stickySelection.selected.baseUrl,
    defaultModel: stickySelection.selected.defaultModel,
    enabledModels: stickySelection.selected.enabledModels,
  };
};

const parsePayloadChannel = (payload: TaskPayload): string => {
  if (!isRecord(payload)) {
    return `chat-ui`;
  }

  return normalizeString(payload.channel) ?? `chat-ui`;
};

const assertActionAllowed = (task: Task, action: string): void => {
  if (task.status === `completed`) {
    throw new TaskConflictError(`Cannot ${action} because this task is already completed.`);
  }

  if (task.status === `processing`) {
    throw new TaskConflictError(`Cannot ${action} because this task is currently processing.`);
  }
};

const resolveActionTask = async (loopId: string, userId: string, taskId?: string): Promise<Task> => {
  if (taskId) {
    const task = await queryTaskById(taskId);

    if (!task || task.loop !== loopId || task.sourceType !== `chat-ui`) {
      throw new TaskValidationError(`Task not found for this loop.`);
    }

    return task;
  }

  const latestTask = await queryLoopLatestTask(loopId, userId);

  if (!latestTask) {
    throw new TaskValidationError(`No task found for this loop.`);
  }

  return latestTask;
};

const assertLoopReadyForChat = async (loopId: string): Promise<void> => {
  const readiness = evaluateLoopReadiness(loopId, await queryLoopReadinessCounts(loopId));

  if (!readiness.blocked) {
    return;
  }

  const blockerMessages = readiness.blockers.map((blocker) => blocker.message).join(` `);
  throw new TaskConflictError(`Loop is blocked. ${blockerMessages}`);
};

export const taskPromotePoolReadyTasks = async (): Promise<void> => {
  const loops = await queryLoopsWithPoolNotReadyTasks();

  for (const loopId of loops) {
    const readiness = evaluateLoopReadiness(loopId, await queryLoopReadinessCounts(loopId));

    if (!readiness.blocked) {
      await queryPromotePoolNotReadyTasksToQueued(loopId);
    }
  }
};

const guardClaimedTaskLoopReadiness = async (task: Task, claimToken: string): Promise<boolean> => {
  const readiness = evaluateLoopReadiness(task.loop, await queryLoopReadinessCounts(task.loop));

  if (!readiness.blocked) {
    return true;
  }

  const blockerMessages = readiness.blockers.map((blocker) => blocker.message).join(` `);

  const payload = appendTimelineEntries(task.payload, [
    makeTimelineEntry(`task-blocked`, `system`, {
      blocker: `Loop readiness blocked processing.`,
      details: blockerMessages,
    }),
    makeTimelineEntry(`waiting-user-input`, `system`, {
      reason: `Loop readiness is currently blocked and requires operator action.`,
    }),
  ]);

  await queryTaskUpdate({
    id: task.id,
    status: `pool-not-ready`,
    blocker: `Pool not ready. ${blockerMessages}`,
    payload,
    context: `Pool not ready for processing. ${blockerMessages}`,
    expectedClaimToken: claimToken,
    clearClaim: true,
  });

  return false;
};

const readRoutingFailureMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const resolveExpectedExecutionLane = (taskKind: TaskKind): ExecutionLane => {
  return resolveRequiredExecutionLaneForTaskKind(taskKind);
};

const validateExecutionLane = (
  taskKind: TaskKind,
  targetType: `provider` | `runner`,
): { valid: true; selectedLane: ExecutionLane; expectedLane: ExecutionLane } | { valid: false; selectedLane: ExecutionLane; expectedLane: ExecutionLane; reason: string } => {
  const selectedLane = executionLaneForTargetType(targetType);
  const expectedLane = resolveExpectedExecutionLane(taskKind);

  if (selectedLane === expectedLane) {
    return { valid: true, selectedLane, expectedLane };
  }

  return {
    valid: false,
    selectedLane,
    expectedLane,
    reason: `Task kind ${taskKind} requires ${expectedLane}, but routing selected ${selectedLane}.`,
  };
};

const dispatchRoutedTask = async (task: Task, claimToken?: string): Promise<Task> => {
  const loopPersonas = await queryLoopPersonaList(task.loop);
  const activePersonas = loopPersonas.filter((persona) => persona.lifecycleStatus === `active`);
  const routingPersona = getActiveRoutingPersona(activePersonas);
  const iterationCostLimitUsd = await readLoopIterationCostLimitUsd(task.loop);
  const enabledProviderToolNames = await readLoopEnabledProviderToolNames(task.loop);
  const routingPayload = task.payload.routing;

  if (!task.selectedPersona || !routingPayload) {
    const failPayload = appendTimelineEntries(task.payload, [
      makeTimelineEntry(`task-blocked`, `system`, {
        blocker: `Queued execution task is missing routing metadata.`,
      }),
      makeTimelineEntry(`waiting-user-input`, routingPersona.displayName, {
        reason: `Task is missing routing metadata. Requires re-routing.`,
      }),
    ]);

    return queryTaskUpdate({
      id: task.id,
      phase: `routing`,
      status: `requires-user-input`,
      payload: failPayload,
      context: `Routing metadata missing on queued task.`,
      expectedClaimToken: claimToken,
      clearClaim: Boolean(claimToken),
    });
  }

  const selectedPersona = activePersonas.find((persona) => persona.id === task.selectedPersona);

  if (!selectedPersona) {
    const failPayload = appendTimelineEntries(task.payload, [
      makeTimelineEntry(`task-blocked`, routingPersona.displayName, {
        blocker: `Assigned persona is no longer active.`,
      }),
      makeTimelineEntry(`waiting-user-input`, routingPersona.displayName, {
        reason: `Persona became inactive. Requires re-routing.`,
      }),
    ]);

    return queryTaskUpdate({
      id: task.id,
      phase: `routing`,
      status: `requires-user-input`,
      payload: failPayload,
      context: `Assigned persona became inactive.`,
      expectedClaimToken: claimToken,
      clearClaim: Boolean(claimToken),
    });
  }

  const selectedModel = routingPayload.selectedModel;
  const blockedModels = readTaskBlockedModels(task.payload);

  if (selectedModel && blockedModels.includes(selectedModel)) {
    const failPayload = appendTimelineEntries(task.payload, [
      makeTimelineEntry(`task-blocked`, `system`, {
        blocker: `Selected provider model is blocked for this task after previous 404 failures.`,
        selectedModel,
        blockedModels,
      }),
    ]);

    return queryTaskUpdate({
      id: task.id,
      phase: `execution`,
      status: `blocked`,
      blocker: `Selected provider model is blocked for this task.`,
      payload: failPayload,
      context: `Selected provider model is blocked for this task and requires re-routing.`,
      expectedClaimToken: claimToken,
      clearClaim: Boolean(claimToken),
    });
  }

  const stickyTarget = await resolveStickyExecutionTarget(task);
  const routedTargetType = task.targetType ?? routingPayload.targetType ?? null;
  const resolvedTarget =
    stickyTarget.targetType && stickyTarget.targetId && stickyTarget.secret && stickyTarget.definitionType
      ? stickyTarget
      : routedTargetType
        ? await resolveExecutionTarget(task.loop, routedTargetType)
        : await resolveExecutionTarget(task.loop, `provider`);

  if (resolvedTarget.targetType) {
    const laneValidation = validateExecutionLane(task.kind, resolvedTarget.targetType);

    if (!laneValidation.valid) {
      const failPayload = appendTimelineEntries(task.payload, [
        makeTimelineEntry(`task-blocked`, `system`, {
          blocker: `Execution lane policy blocked queued execution target.`,
          details: laneValidation.reason,
          taskKind: task.kind,
          selectedLane: laneValidation.selectedLane,
          expectedLane: laneValidation.expectedLane,
        }),
        makeTimelineEntry(`waiting-user-input`, routingPersona.displayName, {
          reason: `Execution target violates lane policy and requires re-routing.`,
        }),
      ]);

      return queryTaskUpdate({
        id: task.id,
        phase: `routing`,
        status: `requires-user-input`,
        blocker: laneValidation.reason,
        payload: failPayload,
        context: laneValidation.reason,
        expectedClaimToken: claimToken,
        clearClaim: Boolean(claimToken),
      });
    }
  }

  if (resolvedTarget.targetType === `provider` && !selectedModel) {
    const failPayload = appendTimelineEntries(task.payload, [
      makeTimelineEntry(`task-blocked`, `system`, {
        blocker: `Provider execution requires selectedModel.`,
      }),
      makeTimelineEntry(`waiting-user-input`, routingPersona.displayName, {
        reason: `Provider lane requires model selection. Re-route required.`,
      }),
    ]);

    return queryTaskUpdate({
      id: task.id,
      phase: `routing`,
      status: `requires-user-input`,
      blocker: `Provider lane requires selectedModel.`,
      payload: failPayload,
      context: `Provider lane requires selectedModel for execution.`,
      expectedClaimToken: claimToken,
      clearClaim: Boolean(claimToken),
    });
  }

  const canExecuteTarget =
    resolvedTarget.targetType === `provider`
      ? Boolean(resolvedTarget.targetId && resolvedTarget.secret && resolvedTarget.definitionType)
      : Boolean(resolvedTarget.targetType === `runner` && resolvedTarget.targetId && resolvedTarget.secret && resolvedTarget.definitionType);

  const executionResult =
    canExecuteTarget && resolvedTarget.targetType === `provider` && resolvedTarget.targetId && resolvedTarget.definitionType && resolvedTarget.secret
      ? {
          status: `requires-user-input` as const,
          summary: `Provider execution deferred to autonomy loop.`,
          output: `Provider execution deferred to autonomy loop.`,
          llmCostUsd: 0,
          llmCallCount: 0,
        }
      : canExecuteTarget && resolvedTarget.targetType === `runner` && resolvedTarget.targetId && resolvedTarget.definitionType && resolvedTarget.secret
        ? await executeTaskTarget(task, selectedPersona, {
            targetType: `runner`,
            targetId: resolvedTarget.targetId,
            definitionType: resolvedTarget.definitionType,
            secret: resolvedTarget.secret,
            baseUrl: resolvedTarget.baseUrl,
          })
        : {
            status: `blocked` as const,
            summary: `No eligible execution target is currently available.`,
            output: `No runner/provider assignment with required execution metadata is enabled for this loop and persona routing decision.`,
            blocker: `No eligible execution target`,
            llmCostUsd: 0,
            llmCallCount: 0,
          };

  const executeProviderAutonomyLoop = async (): Promise<{ result: TaskExecutionResult; attemptsUsed: number; llmTimelineEntries: TimelineEntry[]; llmCostUsd: number; llmCallCount: number }> => {
    let attemptsUsed = task.autonomyIterationCount;
    let workingTask: Task = task;
    let workingPayload: TaskPayload = appendTimelineEntries(task.payload, [
      makeTimelineEntry(`system-action-started`, selectedPersona.displayName, {
        targetType: resolvedTarget.targetType,
        targetId: resolvedTarget.targetId,
        executionLane: resolvedTarget.targetType ? executionLaneForTargetType(resolvedTarget.targetType) : null,
        note: `Execution started by selected assignee.`,
      }),
    ]);
    let finalResult: TaskExecutionResult = executionResult;
    const llmTimelineEntries: TimelineEntry[] = [];
    let llmCostUsd = 0;
    let llmCallCount = 0;

    await queryTaskUpdate({
      id: task.id,
      payload: workingPayload,
      context: `${selectedPersona.displayName} execution started.`,
      expectedClaimToken: claimToken,
    });

    while (true) {
      const nextTask: Task = {
        ...workingTask,
        autonomyIterationCount: attemptsUsed,
        payload: workingPayload,
        autonomyMaxIterations: task.autonomyMaxIterations,
      };

      finalResult = await executeTaskTarget(
        nextTask,
        selectedPersona,
        {
          targetType: `provider`,
          targetId: resolvedTarget.targetId as string,
          definitionType: resolvedTarget.definitionType as string,
          secret: resolvedTarget.secret as string,
          baseUrl: resolvedTarget.baseUrl,
          model: selectedModel as string,
        },
        {
          iterationCostLimitUsd,
          enabledProviderToolNames,
          onTimelineEntry: async (entry, progress) => {
            workingPayload = appendTimelineEntry(workingPayload, entry);

            await queryTaskUpdate({
              id: task.id,
              payload: workingPayload,
              context: `${selectedPersona.displayName} execution in progress (iteration ${progress.iteration}, round ${progress.toolRound}).`,
              llmCostUsdTotal: addUsdCost(task.llmCostUsdTotal, llmCostUsd + progress.llmCostUsd),
              expectedClaimToken: claimToken,
            });
          },
        },
      );

      llmTimelineEntries.push(...(finalResult.llmTimelineEntries ?? []));
      llmCostUsd = addUsdCost(llmCostUsd, finalResult.llmCostUsd);
      llmCallCount += finalResult.llmCallCount;
      attemptsUsed += 1;

      if (finalResult.status === `blocked`) {
        return {
          result: {
            ...finalResult,
            llmTimelineEntries: Array.isArray(workingPayload.timeline) ? workingPayload.timeline : [],
          },
          attemptsUsed,
          llmTimelineEntries,
          llmCostUsd,
          llmCallCount,
        };
      }

      if (finalResult.status === `requires-user-approval`) {
        return {
          result: {
            ...finalResult,
            llmTimelineEntries: Array.isArray(workingPayload.timeline) ? workingPayload.timeline : [],
          },
          attemptsUsed,
          llmTimelineEntries,
          llmCostUsd,
          llmCallCount,
        };
      }

      if (finalResult.status === `requires-user-input`) {
        return {
          result: {
            ...finalResult,
            llmTimelineEntries: Array.isArray(workingPayload.timeline) ? workingPayload.timeline : [],
          },
          attemptsUsed,
          llmTimelineEntries,
          llmCostUsd,
          llmCallCount,
        };
      }

      if (finalResult.achieved) {
        return {
          result: {
            ...finalResult,
            status: `completed`,
            llmTimelineEntries: Array.isArray(workingPayload.timeline) ? workingPayload.timeline : [],
          },
          attemptsUsed,
          llmTimelineEntries,
          llmCostUsd,
          llmCallCount,
        };
      }

      workingTask = {
        ...workingTask,
        context: finalResult.nextContext?.trim().length ? finalResult.nextContext : `${workingTask.context}\n\nPrevious iteration output:\n${finalResult.output}`,
      };
    }
  };

  const shouldRunProviderAutonomyLoop = canExecuteTarget && resolvedTarget.targetType === `provider` && Boolean(resolvedTarget.targetId && resolvedTarget.definitionType && resolvedTarget.secret);

  const autonomyLoopResult = shouldRunProviderAutonomyLoop
    ? await executeProviderAutonomyLoop()
    : {
        result: executionResult,
        attemptsUsed: task.autonomyIterationCount,
        llmTimelineEntries: executionResult.llmTimelineEntries ?? [],
        llmCostUsd: executionResult.llmCostUsd,
        llmCallCount: executionResult.llmCallCount,
      };

  const effectiveExecutionResult = autonomyLoopResult.result;
  const autonomyIterationCount = shouldRunProviderAutonomyLoop ? autonomyLoopResult.attemptsUsed : task.autonomyIterationCount;
  const routeReasonCode = task.routeReasonCode ?? `ROUTED_FROM_FIRST_MESSAGE`;

  if (shouldRunProviderAutonomyLoop && effectiveExecutionResult.status === `blocked`) {
    const model404Failure = readProviderModel404Failure(effectiveExecutionResult);

    if (model404Failure) {
      const reroutePayloadBase: TaskPayload = Array.isArray(effectiveExecutionResult.llmTimelineEntries)
        ? {
            ...task.payload,
            timeline: effectiveExecutionResult.llmTimelineEntries,
            pendingToolApprovalRequest: null,
          }
        : {
            ...task.payload,
            pendingToolApprovalRequest: null,
          };

      const reroutePayload = appendTimelineEntries(appendTaskBlockedModel(reroutePayloadBase, model404Failure.model), [
        makeTimelineEntry(`task-blocked`, `system`, {
          blocker: `Provider model returned 404 and was blocked for this task.`,
          model: model404Failure.model,
          reason: model404Failure.reason,
        }),
      ]);

      return queryTaskUpdate({
        id: task.id,
        phase: `execution`,
        status: `blocked`,
        assignee: selectedPersona.id,
        selectedPersona: selectedPersona.id,
        targetType: resolvedTarget.targetType,
        targetId: resolvedTarget.targetId,
        blocker: `Provider model unavailable (404): ${model404Failure.model}`,
        payload: reroutePayload,
        routing: withRoutingMetadata(task.routing, routingPersona.id, routeReasonCode),
        context: `Provider model ${model404Failure.model} returned 404 and was blocked for this task. Re-routing queued.`,
        completedAt: null,
        autonomyIterationCount,
        autonomyMaxIterations: task.autonomyMaxIterations > 0 ? task.autonomyMaxIterations : defaultAutonomyMaxIterations,
        llmCostUsdTotal: addUsdCost(task.llmCostUsdTotal, autonomyLoopResult.llmCostUsd),
        expectedClaimToken: claimToken,
        clearClaim: Boolean(claimToken),
      });
    }
  }

  const liveTimelinePayload =
    shouldRunProviderAutonomyLoop && Array.isArray(effectiveExecutionResult.llmTimelineEntries)
      ? {
          ...task.payload,
          timeline: effectiveExecutionResult.llmTimelineEntries,
        }
      : task.payload;

  const payloadWithApprovalState: TaskPayload = {
    ...liveTimelinePayload,
    pendingToolApprovalRequest: effectiveExecutionResult.status === `requires-user-approval` ? (effectiveExecutionResult.pendingToolApprovalRequest ?? liveTimelinePayload.pendingToolApprovalRequest ?? null) : null,
  };

  const resultTimelineEntries: TimelineEntry[] = [
    makeTimelineEntry(`system-action-result`, selectedPersona.displayName, {
      outcome: effectiveExecutionResult.status,
      summary: effectiveExecutionResult.summary,
      output: effectiveExecutionResult.output,
      executionLane: resolvedTarget.targetType ? executionLaneForTargetType(resolvedTarget.targetType) : null,
      autonomyIterationCount,
      autonomyMaxIterations: task.autonomyMaxIterations,
      llmCostUsdInRun: autonomyLoopResult.llmCostUsd,
      llmCallCountInRun: autonomyLoopResult.llmCallCount,
    }),
  ];

  if (effectiveExecutionResult.status !== `completed`) {
    resultTimelineEntries.push(
      makeTimelineEntry(`waiting-user-input`, selectedPersona.displayName, {
        reason:
          effectiveExecutionResult.status === `blocked`
            ? `Execution encountered a blocker and needs user intervention.`
            : effectiveExecutionResult.status === `requires-user-approval`
              ? `Execution requires explicit user approval before continuing.`
              : effectiveExecutionResult.terminalIntent === `request-chat`
                ? `Execution requested a chat response from the user.`
                : `Execution requires user response before continuing.`,
        prompt: effectiveExecutionResult.requestedChatPrompt,
      }),
    );
  }

  const updatedPayload = appendTimelineEntries(payloadWithApprovalState, resultTimelineEntries);

  return queryTaskUpdate({
    id: task.id,
    phase: effectiveExecutionResult.status === `completed` ? `done` : `execution`,
    status: effectiveExecutionResult.status,
    assignee: selectedPersona.id,
    selectedPersona: selectedPersona.id,
    targetType: resolvedTarget.targetType,
    targetId: resolvedTarget.targetId,
    blocker: effectiveExecutionResult.status === `blocked` ? (effectiveExecutionResult.blocker ?? `Execution blocked`) : null,
    payload: updatedPayload,
    routing: withRoutingMetadata(task.routing, routingPersona.id, routeReasonCode),
    context:
      effectiveExecutionResult.status === `blocked`
        ? `${selectedPersona.displayName} execution blocked: ${effectiveExecutionResult.blocker ?? effectiveExecutionResult.summary}`
        : effectiveExecutionResult.terminalIntent === `request-chat`
          ? `${selectedPersona.displayName} requested user chat input: ${effectiveExecutionResult.requestedChatPrompt ?? effectiveExecutionResult.output}`
          : `${selectedPersona.displayName} execution output: ${effectiveExecutionResult.output.slice(0, 300)}`,
    completedAt: effectiveExecutionResult.status === `completed` ? new Date().toISOString() : null,
    autonomyIterationCount,
    autonomyMaxIterations: task.autonomyMaxIterations > 0 ? task.autonomyMaxIterations : defaultAutonomyMaxIterations,
    llmCostUsdTotal: addUsdCost(task.llmCostUsdTotal, autonomyLoopResult.llmCostUsd),
    expectedClaimToken: claimToken,
    clearClaim: Boolean(claimToken),
  });
};

const executeRoutingDecision = async (task: Task, claimToken?: string): Promise<Task> => {
  const loopPersonas = await queryLoopPersonaList(task.loop);
  const activePersonas = loopPersonas.filter((persona) => persona.lifecycleStatus === `active`);
  const routingPersona = getActiveRoutingPersona(activePersonas);
  const iterationCostLimitUsd = await readLoopIterationCostLimitUsd(task.loop);

  const routeDecisionAttempt = await resolveRouterDecisionForTask(task, activePersonas, routingPersona, iterationCostLimitUsd);
  const nextLlmCostUsdTotal = addUsdCost(task.llmCostUsdTotal, routeDecisionAttempt.llmCostUsd);
  const effectiveBlockedModels = Array.from(new Set([...readTaskBlockedModels(task.payload), ...routeDecisionAttempt.blockedModels]));
  const payloadWithBlockedModels: TaskPayload = {
    ...task.payload,
    routing: {
      ...task.payload.routing,
      blockedModels: effectiveBlockedModels,
    },
  };

  if (!routeDecisionAttempt.routeDecision) {
    const message = readRoutingFailureMessage(routeDecisionAttempt.error);
    const failPayload = appendTimelineEntries(payloadWithBlockedModels, [
      ...routeDecisionAttempt.llmTimelineEntries,
      makeTimelineEntry(`task-blocked`, routingPersona.displayName, {
        blocker: `Routing decision failed.`,
        details: message,
      }),
      makeTimelineEntry(`waiting-user-input`, routingPersona.displayName, {
        reason: `Routing decision failed and requires user review.`,
      }),
    ]);

    return queryTaskUpdate({
      id: task.id,
      phase: `routing`,
      status: `requires-user-input`,
      blocker: `Routing decision failed: ${message}`,
      payload: failPayload,
      context: `Routing decision failed. ${message}`,
      llmCostUsdTotal: nextLlmCostUsdTotal,
      expectedClaimToken: claimToken,
      clearClaim: Boolean(claimToken),
    });
  }

  const routeDecision = routeDecisionAttempt.routeDecision;
  const selectedPersona = activePersonas.find((persona) => persona.id === routeDecision.selectedPersona);

  if (!selectedPersona) {
    const failPayload = appendTimelineEntries(payloadWithBlockedModels, [
      ...routeDecisionAttempt.llmTimelineEntries,
      makeTimelineEntry(`task-blocked`, routingPersona.displayName, {
        blocker: `Selected persona is no longer active.`,
      }),
      makeTimelineEntry(`waiting-user-input`, routingPersona.displayName, {
        reason: `Routing selected an inactive persona. Requires re-routing.`,
      }),
    ]);

    return queryTaskUpdate({
      id: task.id,
      phase: `routing`,
      status: `requires-user-input`,
      payload: failPayload,
      context: `Selected persona became inactive.`,
      llmCostUsdTotal: nextLlmCostUsdTotal,
      expectedClaimToken: claimToken,
      clearClaim: Boolean(claimToken),
    });
  }

  const resolvedTarget = await resolveExecutionTarget(task.loop, routeDecision.targetType);

  if (!resolvedTarget.targetType || !resolvedTarget.targetId) {
    const failPayload = appendTimelineEntries(payloadWithBlockedModels, [
      ...routeDecisionAttempt.llmTimelineEntries,
      makeTimelineEntry(`task-blocked`, routingPersona.displayName, {
        blocker: `No eligible ${routeDecision.targetType} assignment is available for the routing decision.`,
      }),
      makeTimelineEntry(`waiting-user-input`, routingPersona.displayName, {
        reason: `Routing chose ${routeDecision.targetType}, but no eligible assignment is currently available.`,
      }),
    ]);

    return queryTaskUpdate({
      id: task.id,
      phase: `routing`,
      status: `requires-user-input`,
      blocker: `No eligible ${routeDecision.targetType} assignment is available for routing.`,
      payload: failPayload,
      context: `Routing chose ${routeDecision.targetType}, but no eligible assignment is currently available.`,
      llmCostUsdTotal: nextLlmCostUsdTotal,
      expectedClaimToken: claimToken,
      clearClaim: Boolean(claimToken),
    });
  }

  const laneValidation = validateExecutionLane(routeDecision.taskKind, resolvedTarget.targetType);

  if (!laneValidation.valid) {
    const failPayload = appendTimelineEntries(payloadWithBlockedModels, [
      ...routeDecisionAttempt.llmTimelineEntries,
      makeTimelineEntry(`task-blocked`, routingPersona.displayName, {
        blocker: `Execution lane policy rejected routing decision.`,
        details: laneValidation.reason,
        selectedLane: laneValidation.selectedLane,
        expectedLane: laneValidation.expectedLane,
      }),
      makeTimelineEntry(`waiting-user-input`, routingPersona.displayName, {
        reason: `Routing selected an execution lane that violates policy.`,
      }),
    ]);

    return queryTaskUpdate({
      id: task.id,
      phase: `routing`,
      status: `requires-user-input`,
      blocker: laneValidation.reason,
      payload: failPayload,
      context: laneValidation.reason,
      llmCostUsdTotal: nextLlmCostUsdTotal,
      expectedClaimToken: claimToken,
      clearClaim: Boolean(claimToken),
    });
  }

  const decisionPayload = appendTimelineEntries(
    {
      ...payloadWithBlockedModels,
      routing: {
        selectedPersona: selectedPersona.id,
        selectedPersonaDisplayName: selectedPersona.displayName,
        selectedModel: routeDecision.selectedModel,
        blockedModels: effectiveBlockedModels,
        targetType: routeDecision.targetType,
        taskKind: routeDecision.taskKind,
        executionLane: laneValidation.selectedLane,
        requiredExecutionLane: laneValidation.expectedLane,
        conversationMode: routeDecisionAttempt.conversationMode ?? undefined,
        routeReasonCode: routeDecision.routeReasonCode,
        routeReasonText: routeDecision.routeReasonText,
      },
    },
    [
      ...routeDecisionAttempt.llmTimelineEntries,
      makeTimelineEntry(`routing-decision`, routingPersona.displayName, {
        selectedPersona: selectedPersona.id,
        selectedPersonaDisplayName: selectedPersona.displayName,
        selectedModel: routeDecision.selectedModel,
        taskKind: routeDecision.taskKind,
        routeReasonCode: routeDecision.routeReasonCode,
        routeReasonText: routeDecision.routeReasonText,
        executionLane: laneValidation.selectedLane,
        requiredExecutionLane: laneValidation.expectedLane,
        conversationMode: routeDecisionAttempt.conversationMode,
        targetType: resolvedTarget.targetType,
        targetId: resolvedTarget.targetId,
      }),
    ],
  );

  return queryTaskUpdate({
    id: task.id,
    phase: `execution`,
    status: `queued`,
    assignee: selectedPersona.id,
    selectedPersona: selectedPersona.id,
    targetType: resolvedTarget.targetType,
    targetId: resolvedTarget.targetId,
    kind: routeDecision.taskKind,
    routeReasonCode: routeDecision.routeReasonCode,
    routeReasonText: routeDecision.routeReasonText,
    blocker: null,
    payload: decisionPayload,
    routing: withRoutingMetadata(task.routing, routingPersona.id, routeDecision.routeReasonCode),
    context:
      routeDecision.targetType === `provider`
        ? `Routing decision made. Assigned to ${selectedPersona.displayName}, model ${routeDecision.selectedModel}, target ${routeDecision.targetType}, lane ${laneValidation.selectedLane}.`
        : `Routing decision made. Assigned to ${selectedPersona.displayName}, target ${routeDecision.targetType}, lane ${laneValidation.selectedLane}.`,
    llmCostUsdTotal: nextLlmCostUsdTotal,
    expectedClaimToken: claimToken,
    clearClaim: Boolean(claimToken),
  });
};

const reEvaluateBlockedTask = async (task: Task, claimToken?: string): Promise<Task> => {
  const loopPersonas = await queryLoopPersonaList(task.loop);
  const activePersonas = loopPersonas.filter((persona) => persona.lifecycleStatus === `active`);
  const routingPersona = getActiveRoutingPersona(activePersonas);
  const iterationCostLimitUsd = await readLoopIterationCostLimitUsd(task.loop);

  const routeDecisionAttempt = await resolveRouterDecisionForTask(task, activePersonas, routingPersona, iterationCostLimitUsd);
  const nextLlmCostUsdTotal = addUsdCost(task.llmCostUsdTotal, routeDecisionAttempt.llmCostUsd);
  const effectiveBlockedModels = Array.from(new Set([...readTaskBlockedModels(task.payload), ...routeDecisionAttempt.blockedModels]));
  const payloadWithBlockedModels: TaskPayload = {
    ...task.payload,
    routing: {
      ...task.payload.routing,
      blockedModels: effectiveBlockedModels,
    },
  };

  if (!routeDecisionAttempt.routeDecision) {
    const message = readRoutingFailureMessage(routeDecisionAttempt.error);
    const failPayload = appendTimelineEntries(payloadWithBlockedModels, [
      ...routeDecisionAttempt.llmTimelineEntries,
      makeTimelineEntry(`routing-decision`, routingPersona.displayName, {
        result: `routing-failed`,
        details: message,
      }),
      makeTimelineEntry(`waiting-user-input`, routingPersona.displayName, {
        reason: `Re-evaluation failed. Requires user intervention.`,
      }),
    ]);

    return queryTaskUpdate({
      id: task.id,
      phase: `routing`,
      status: `requires-user-input`,
      blocker: null,
      payload: failPayload,
      context: `Re-evaluation failed: ${message}`,
      llmCostUsdTotal: nextLlmCostUsdTotal,
      expectedClaimToken: claimToken,
      clearClaim: Boolean(claimToken),
    });
  }

  const routeDecision = routeDecisionAttempt.routeDecision;
  const selectedPersona = activePersonas.find((persona) => persona.id === routeDecision.selectedPersona);

  if (!selectedPersona) {
    const failPayload = appendTimelineEntries(payloadWithBlockedModels, [
      ...routeDecisionAttempt.llmTimelineEntries,
      makeTimelineEntry(`routing-decision`, routingPersona.displayName, {
        result: `persona-not-found`,
      }),
      makeTimelineEntry(`waiting-user-input`, routingPersona.displayName, {
        reason: `Selected persona is no longer active.`,
      }),
    ]);

    return queryTaskUpdate({
      id: task.id,
      phase: `routing`,
      status: `requires-user-input`,
      payload: failPayload,
      context: `Selected persona became inactive during re-evaluation.`,
      llmCostUsdTotal: nextLlmCostUsdTotal,
      expectedClaimToken: claimToken,
      clearClaim: Boolean(claimToken),
    });
  }

  const resolvedTarget = await resolveExecutionTarget(task.loop, routeDecision.targetType);

  if (!resolvedTarget.targetType || !resolvedTarget.targetId) {
    const failPayload = appendTimelineEntries(payloadWithBlockedModels, [
      ...routeDecisionAttempt.llmTimelineEntries,
      makeTimelineEntry(`routing-decision`, routingPersona.displayName, {
        result: `target-unavailable`,
        targetType: routeDecision.targetType,
      }),
      makeTimelineEntry(`waiting-user-input`, routingPersona.displayName, {
        reason: `Routing chose ${routeDecision.targetType}, but no eligible assignment is currently available.`,
      }),
    ]);

    return queryTaskUpdate({
      id: task.id,
      phase: `routing`,
      status: `requires-user-input`,
      blocker: null,
      payload: failPayload,
      context: `Routing chose ${routeDecision.targetType}, but no eligible assignment is currently available.`,
      llmCostUsdTotal: nextLlmCostUsdTotal,
      expectedClaimToken: claimToken,
      clearClaim: Boolean(claimToken),
    });
  }

  const laneValidation = validateExecutionLane(task.kind, resolvedTarget.targetType);

  if (!laneValidation.valid) {
    const failPayload = appendTimelineEntries(payloadWithBlockedModels, [
      ...routeDecisionAttempt.llmTimelineEntries,
      makeTimelineEntry(`routing-decision`, routingPersona.displayName, {
        result: `execution-lane-policy-rejected`,
        details: laneValidation.reason,
        taskKind: task.kind,
        selectedLane: laneValidation.selectedLane,
        expectedLane: laneValidation.expectedLane,
      }),
      makeTimelineEntry(`waiting-user-input`, routingPersona.displayName, {
        reason: `Re-routing selected an execution lane that violates policy.`,
      }),
    ]);

    return queryTaskUpdate({
      id: task.id,
      phase: `routing`,
      status: `requires-user-input`,
      blocker: null,
      payload: failPayload,
      context: laneValidation.reason,
      llmCostUsdTotal: nextLlmCostUsdTotal,
      expectedClaimToken: claimToken,
      clearClaim: Boolean(claimToken),
    });
  }

  const reEvalPayload = appendTimelineEntries(
    {
      ...payloadWithBlockedModels,
      routing: {
        selectedPersona: selectedPersona.id,
        selectedPersonaDisplayName: selectedPersona.displayName,
        selectedModel: routeDecision.selectedModel,
        taskKind: routeDecision.taskKind,
        blockedModels: effectiveBlockedModels,
        targetType: routeDecision.targetType,
        executionLane: laneValidation.selectedLane,
        requiredExecutionLane: laneValidation.expectedLane,
        conversationMode: routeDecisionAttempt.conversationMode ?? undefined,
        routeReasonCode: routeDecision.routeReasonCode,
        routeReasonText: routeDecision.routeReasonText,
      },
    },
    [
      ...routeDecisionAttempt.llmTimelineEntries,
      makeTimelineEntry(`routing-decision`, routingPersona.displayName, {
        selectedPersona: selectedPersona.id,
        selectedPersonaDisplayName: selectedPersona.displayName,
        selectedModel: routeDecision.selectedModel,
        targetType: routeDecision.targetType,
        conversationMode: routeDecisionAttempt.conversationMode,
        routeReasonCode: routeDecision.routeReasonCode,
        routeReasonText: routeDecision.routeReasonText,
        taskKind: task.kind,
        executionLane: laneValidation.selectedLane,
        requiredExecutionLane: laneValidation.expectedLane,
        note: `Re-routed from blocked state.`,
      }),
    ],
  );

  return queryTaskUpdate({
    id: task.id,
    phase: `execution`,
    status: `queued`,
    assignee: selectedPersona.id,
    selectedPersona: selectedPersona.id,
    targetType: resolvedTarget.targetType,
    targetId: resolvedTarget.targetId,
    routeReasonCode: routeDecision.routeReasonCode,
    routeReasonText: routeDecision.routeReasonText,
    blocker: null,
    payload: reEvalPayload,
    routing: withRoutingMetadata(task.routing, routingPersona.id, routeDecision.routeReasonCode),
    context: `Re-routed from blocked state. Assigned to ${selectedPersona.displayName} on ${routeDecision.targetType}.`,
    llmCostUsdTotal: nextLlmCostUsdTotal,
    expectedClaimToken: claimToken,
    clearClaim: Boolean(claimToken),
  });
};

const taskProcessSingleQueuedTask = async (): Promise<{ routedProcessed: number; blockedRerouted: number }> => {
  const nextTask = await queryNextProcessableTask(queueClaimOwner);

  if (!nextTask) {
    return { routedProcessed: 0, blockedRerouted: 0 };
  }

  const claimToken = nextTask.claimToken;

  if (!claimToken) {
    throw new TaskClaimLostError(`Missing claim token on claimed processing task.`);
  }

  let claimLost = false;
  let heartbeatInFlight = false;

  const heartbeatInterval = setInterval(() => {
    if (heartbeatInFlight || claimLost) {
      return;
    }

    heartbeatInFlight = true;

    void queryTaskPing(nextTask.id, claimToken)
      .then((isLeaseValid) => {
        if (!isLeaseValid) {
          claimLost = true;
        }
      })
      .catch(() => {
        claimLost = true;
      })
      .finally(() => {
        heartbeatInFlight = false;
      });
  }, 10_000);

  const assertClaimLease = (): void => {
    if (claimLost) {
      throw new TaskClaimLostError(`Claim token no longer matches for processing task.`);
    }
  };

  try {
    const sourceStatus = nextTask.processingSourceStatus;

    assertClaimLease();

    if (!(await guardClaimedTaskLoopReadiness(nextTask, claimToken))) {
      return { routedProcessed: 0, blockedRerouted: 0 };
    }

    if (nextTask.phase === `routing` && sourceStatus === `active`) {
      await executeRoutingDecision(nextTask, claimToken);
      return { routedProcessed: 1, blockedRerouted: 0 };
    }

    if (nextTask.phase === `execution` && sourceStatus === `queued`) {
      await dispatchRoutedTask(nextTask, claimToken);
      return { routedProcessed: 1, blockedRerouted: 0 };
    }

    if (nextTask.phase === `execution` && sourceStatus === `blocked`) {
      await reEvaluateBlockedTask(nextTask, claimToken);
      return { routedProcessed: 0, blockedRerouted: 1 };
    }

    return { routedProcessed: 0, blockedRerouted: 0 };
  } catch (error) {
    if (error instanceof TaskClaimLostError) {
      return { routedProcessed: 0, blockedRerouted: 0 };
    }

    throw error;
  } finally {
    clearInterval(heartbeatInterval);
  }
};

export const taskProcessQueue = async (): Promise<{ routedProcessed: number; blockedRerouted: number }> => {
  let routedProcessed = 0;
  let blockedRerouted = 0;

  while (true) {
    const singleResult = await taskProcessSingleQueuedTask();

    routedProcessed += singleResult.routedProcessed;
    blockedRerouted += singleResult.blockedRerouted;

    if (singleResult.routedProcessed === 0 && singleResult.blockedRerouted === 0) {
      break;
    }
  }

  return { routedProcessed, blockedRerouted };
};

const triggerQueueProcessing = (): void => {
  void taskProcessQueue().catch(() => undefined);
};

export const taskCreate = async (request: ValidatedCreateTaskRequest, userId?: string): Promise<CreateTaskResponse> => {
  // Retrieve loop - with auth check if userId provided, otherwise assume system operation
  let loop: Awaited<ReturnType<typeof queryLoopForUser>>;

  if (userId) {
    loop = await queryLoopForUser(request.loop, userId);

    if (!loop) {
      throw new TaskAccessError(`Loop not found.`);
    }

    await assertLoopReadyForChat(request.loop);
  } else {
    // System operation (e.g., workgraph sync) - no user auth required
    loop = await queryLoopById(request.loop);

    if (!loop) {
      throw new TaskAccessError(`Loop not found.`);
    }
  }

  if (request.resumeTaskId) {
    const resumeTask = await queryTaskById(request.resumeTaskId);

    if (!resumeTask || resumeTask.loop !== request.loop) {
      throw new TaskAccessError(`Task not found.`);
    }

    if (resumeTask.status !== `requires-user-input` && resumeTask.status !== `requires-user-approval`) {
      throw new TaskConflictError(`Only tasks requiring user input or approval can be continued.`);
    }

    if (resumeTask.phase === `routing`) {
      const loopPersonas = await queryLoopPersonaList(request.loop);
      const activePersonas = loopPersonas.filter((persona) => persona.lifecycleStatus === `active`);
      const routingPersona = getActiveRoutingPersona(activePersonas);
      const updatedPayload = appendTimelineEntries(withRoutingResponder(resumeTask.payload, routingPersona), [
        makeTimelineEntry(`chat-session`, `chat-ui`, {
          channel: parsePayloadChannel(resumeTask.payload),
          turns: [{ speaker: `user`, message: request.description }],
        }),
      ]);

      const updatedTask = await queryTaskUpdate({
        id: resumeTask.id,
        phase: `routing`,
        status: `active`,
        assignee: routingPersona.id,
        selectedPersona: routingPersona.id,
        blocker: null,
        payload: updatedPayload,
        context: `User provided routing input. Task queued for routing decision.`,
      });

      triggerQueueProcessing();

      return { loop, tasks: [updatedTask] };
    }

    const approvalDecision = request.approvalDecision ?? null;
    if (resumeTask.status === `requires-user-approval` && !approvalDecision) {
      throw new TaskConflictError(`Task is waiting for approval. Submit Approve or Reject with the pending request id.`);
    }

    const pendingToolApprovalRequest = approvalDecision ? readPendingToolApprovalRequest(resumeTask) : null;

    if (approvalDecision && !pendingToolApprovalRequest) {
      throw new TaskConflictError(`No pending tool approval request exists for this task.`);
    }

    const activePendingToolApprovalRequest = pendingToolApprovalRequest as NonNullable<typeof pendingToolApprovalRequest>;

    if (approvalDecision && approvalDecision.requestId !== activePendingToolApprovalRequest?.requestId) {
      throw new TaskConflictError(`Approval decision request-id does not match the pending tool approval request.`);
    }

    const userMessage = approvalDecision?.message ?? request.description;
    const approvalSummaryMessage = approvalDecision
      ? approvalDecision.message
        ? `Approval decision (${approvalDecision.requestId}): ${approvalDecision.decision}. Message: ${approvalDecision.message}`
        : `Approval decision (${approvalDecision.requestId}): ${approvalDecision.decision}.`
      : userMessage;

    const updatedPayload = appendTimelineEntries(
      resumeTask.payload,
      [
        makeTimelineEntry(`chat-session`, `chat-ui`, {
          channel: parsePayloadChannel(resumeTask.payload),
          turns: [{ speaker: `user`, message: approvalSummaryMessage }],
        }),
      ].concat(
        approvalDecision
          ? [
              makeTimelineEntry(`user-approval`, `user`, {
                approvalType: `tool-call`,
                mode: `llm`,
                decision: approvalDecision.decision,
                note: approvalDecision.message,
                approvalRequestId: activePendingToolApprovalRequest.requestId,
                approvalRequestFingerprint: activePendingToolApprovalRequest.approvalFingerprint,
              }),
            ]
          : [],
      ),
    );

    const updatedTask = await queryTaskUpdate({
      id: resumeTask.id,
      phase: `execution`,
      status: `queued`,
      blocker: null,
      payload: updatedPayload,
      context: `${resumeTask.context}\n\nHuman message:\n${approvalSummaryMessage}`,
    });

    triggerQueueProcessing();

    return {
      loop,
      tasks: [updatedTask],
      routeDecision: resumeTask.selectedPersona
        ? {
            selectedPersona: resumeTask.selectedPersona,
            selectedModel: resumeTask.payload.routing?.selectedModel ?? (await resolveProviderDefaultModel(resumeTask.loop, resumeTask.targetType === `provider` ? resumeTask.targetId : null)),
            targetType: resumeTask.targetType ?? `provider`,
            taskKind: resumeTask.kind,
            routeReasonCode: `REUSED_PREVIOUS_SELECTION`,
            routeReasonText: `Continued with the currently assigned persona.`,
          }
        : undefined,
    };
  }

  // New task — create in routing phase and queue routing decision immediately
  const loopPersonas = await queryLoopPersonaList(request.loop);
  const activePersonas = loopPersonas.filter((persona) => persona.lifecycleStatus === `active`);
  const routingPersona = getActiveRoutingPersona(activePersonas);
  const channel = parsePayloadChannel(request.payload);

  const initialPayload = appendTimelineEntries(withRoutingResponder({ ...request.payload, channel, timeline: [] }, routingPersona), [
    makeTimelineEntry(`task-created`, routingPersona.displayName, {
      sourceType: request.sourceType,
      description: request.description,
    }),
    makeTimelineEntry(`chat-session`, `chat-ui`, {
      channel,
      turns: [{ speaker: `user`, message: request.description }],
    }),
  ]);

  const createdTask = await queryTaskCreate(
    {
      loop: request.loop,
      phase: `routing`,
      sourceType: request.sourceType,
      sourceRef: normalizeString(request.sourceRef) ?? null,
      status: `active`,
      assignee: routingPersona.id,
      selectedPersona: routingPersona.id,
      targetType: null,
      targetId: null,
      routeReasonCode: null,
      routeReasonText: null,
      description: request.description,
      ...buildTaskDefaults(request),
      emittedByPersona: routingPersona.id,
      blocker: null,
      approvals: request.approvals,
      payload: initialPayload,
      completedAt: null,
      autonomyIterationCount: 0,
      autonomyMaxIterations: defaultAutonomyMaxIterations,
    },
    { workgraphItemId: initialPayload.workgraphItem?.id },
  );

  if (!createdTask) {
    throw new TaskConflictError(`Task was not created.`);
  }

  triggerQueueProcessing();

  return { loop, tasks: [createdTask] };
};

export const taskMarkCompleted = async (loopId: string, userId: string, note?: string, taskId?: string): Promise<Task> => {
  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new TaskAccessError(`Loop not found.`);
  }

  const activeTask = await resolveActionTask(loopId, userId, taskId);

  assertActionAllowed(activeTask, `mark complete`);

  const payload = appendTimelineEntries(activeTask.payload, [
    makeTimelineEntry(`task-completed`, `user`, {
      note: normalizeString(note) ?? `Task marked complete by user.`,
    }),
  ]);

  return queryTaskUpdate({
    id: activeTask.id,
    phase: `done`,
    status: `completed`,
    payload,
    blocker: null,
    completedAt: new Date().toISOString(),
    context: normalizeString(note) ?? `Task marked complete by user approval.`,
  });
};

export const taskMarkBlocked = async (loopId: string, userId: string, blocker: string, note?: string, taskId?: string): Promise<Task> => {
  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new TaskAccessError(`Loop not found.`);
  }

  const activeTask = await resolveActionTask(loopId, userId, taskId);

  assertActionAllowed(activeTask, `mark blocked`);

  const payload = appendTimelineEntries(activeTask.payload, [
    makeTimelineEntry(`task-blocked`, `user`, {
      blocker,
      note: normalizeString(note) ?? `Task marked blocked by user.`,
    }),
  ]);

  return queryTaskUpdate({
    id: activeTask.id,
    phase: `execution`,
    status: `blocked`,
    blocker,
    payload,
    context: normalizeString(note) ?? `Task blocked: ${blocker}`,
  });
};

export const taskUpdateContext = async (loopId: string, userId: string, currentContext: string, note?: string, taskId?: string): Promise<Task> => {
  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new TaskAccessError(`Loop not found.`);
  }

  const activeTask = await resolveActionTask(loopId, userId, taskId);

  assertActionAllowed(activeTask, `update context`);

  const payload = appendTimelineEntries(activeTask.payload, [
    makeTimelineEntry(`system-action-result`, `user`, {
      action: `context-update`,
      currentContext,
      note: normalizeString(note) ?? `Context updated by user.`,
    }),
  ]);

  return queryTaskUpdate({
    id: activeTask.id,
    payload,
    context: currentContext,
  });
};

export const taskListByLoop = async (userId: string, loopId?: string): Promise<Task[]> => {
  if (!loopId) {
    return queryTaskList(userId);
  }

  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new TaskAccessError(`Loop not found.`);
  }

  return queryLoopTaskList(loopId, userId);
};
