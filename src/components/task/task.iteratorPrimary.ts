import { log } from "@components/logging/logging.service.js";
import { queryLoopDisabledProviderToolsById } from "@components/loop/loop.service.js";
import { resolveLoopSelection } from "@components/loop/loop-selection.service.js";
import type { OpenRouterMessage, OpenRouterTool } from "@components/openrouter/openrouter.schema.js";
import { fetchOpenRouterChatCompletion, readOpenRouterAssistantText } from "@components/openrouter/openrouter.service.js";
import { queryLoopPersonaById } from "@components/persona/persona.service.js";
import { isTaskReadyForModel, parseJsonWithSchema } from "@components/task/task.iteratorUtilities.js";
import type { Task, TaskQueueItemInput } from "@components/task/task.schema.js";
import {
  queryAppendQueueItem,
  queryTaskAssignCurrentModel,
  queryTaskAssignCurrentPersona,
  queryTaskAssignCurrentProvider,
  queryTaskGet,
  queryTaskQueueItemStatusUpdate,
  queryTaskWorkgraphItemContext,
} from "@components/task/task.service.js";
import { enabledProviderToolDefinitionsFromDisabled, isProviderToolRequiringApproval, providerToolParametersFromInputSchema } from "@components/tool/tool.catalog.js";
import type { ProviderToolRequest } from "@components/tool/tool.schema.js";
import { executeProviderToolBatch } from "@components/tool/tool.service.js";
import { z } from "zod";

const taskPrimaryResponseSchema = z.object({
  content: z.string().default(``),
});

export type TaskPrimaryIterationOutcome = {
  handled: boolean;
};

const createPrimaryIterationOutcome = (handled: boolean): TaskPrimaryIterationOutcome => ({
  handled,
});

const readPrimaryAssistantContent = (responseMessage: { content?: unknown; tool_calls?: Array<unknown> } | undefined, parseFailureMessage: string): string => {
  const responseText = readOpenRouterAssistantText(responseMessage);
  const parsedResponse = parseJsonWithSchema(taskPrimaryResponseSchema, responseText);

  if (parsedResponse) {
    return parsedResponse.content.trim();
  }

  const fallbackText = responseText.trim();

  if (fallbackText.length > 0) {
    return fallbackText;
  }

  if ((responseMessage?.tool_calls?.length ?? 0) > 0) {
    return ``;
  }

  throw new Error(parseFailureMessage);
};

export const iterateTaskAssignCurrentPersona = async (task: Task, processorId: string): Promise<TaskPrimaryIterationOutcome> => {
  if (task.currentPersona) {
    return createPrimaryIterationOutcome(false);
  }

  const currentPersona = await queryTaskAssignCurrentPersona(task.loop, task.id, processorId);

  if (!currentPersona) {
    return createPrimaryIterationOutcome(false);
  }

  return createPrimaryIterationOutcome(true);
};

export const iterateTaskAssignCurrentProvider = async (task: Task, processorId: string): Promise<TaskPrimaryIterationOutcome> => {
  if (task.currentProvider) {
    return createPrimaryIterationOutcome(false);
  }

  const providerResolution = await resolveLoopSelection(task.loop, `provider`, { capability: `chat` });

  if (!providerResolution.selected) {
    return createPrimaryIterationOutcome(false);
  }

  const currentProvider = await queryTaskAssignCurrentProvider(task.loop, task.id, processorId, providerResolution.selected.assignmentId);

  if (!currentProvider) {
    return createPrimaryIterationOutcome(false);
  }

  return createPrimaryIterationOutcome(true);
};

export const iterateTaskAssignCurrentModel = async (task: Task, processorId: string): Promise<TaskPrimaryIterationOutcome> => {
  if (task.currentModel || !task.currentProvider) {
    return createPrimaryIterationOutcome(false);
  }

  const currentModel = await queryTaskAssignCurrentModel(task.loop, task.id, processorId, task.currentProvider);

  if (!currentModel) {
    return createPrimaryIterationOutcome(false);
  }

  return createPrimaryIterationOutcome(true);
};

export const iterateTaskInitialGreeting = async (task: Task, processorId: string): Promise<TaskPrimaryIterationOutcome> => {
  const shouldAppendInitialGreeting = task.source === `user` && task.queue.length === 0;

  if (!shouldAppendInitialGreeting) {
    return createPrimaryIterationOutcome(false);
  }

  const initialGreetingQueueItem: TaskQueueItemInput = {
    type: `message`,
    status: `completed`,
    persona: task.currentPersona,
    value: {
      role: `assistant`,
      content: `Hello, how can I help you?`,
    },
  };

  const inserted = await queryAppendQueueItem(task.id, processorId, initialGreetingQueueItem);

  if (!inserted) {
    return createPrimaryIterationOutcome(false);
  }

  log.info(`Task iterate inserted initial user greeting`, { taskId: task.id, processorId });
  return createPrimaryIterationOutcome(true);
};

export const iterateTaskBootstrapWorkgraphItem = async (task: Task, processorId: string): Promise<TaskPrimaryIterationOutcome> => {
  if (task.source !== `workgraphItem` || task.queue.length > 0) {
    return createPrimaryIterationOutcome(false);
  }

  const readiness = await isTaskReadyForModel(task);

  if (!readiness.ready) {
    if (readiness.reason === "provider-unavailable") {
      log.warn(`Task iterate skipped workgraph bootstrap because no provider selection is available`, {
        taskId: task.id,
        loopId: task.loop,
      });
      return createPrimaryIterationOutcome(false);
    }

    log.warn(`Task iterate skipped workgraph bootstrap because provider baseUrl or model is missing`, {
      taskId: task.id,
      loopId: task.loop,
      providerId: readiness.providerResolution.selected?.assignmentId ?? null,
      hasBaseUrl: Boolean(readiness.baseUrl),
      hasModel: Boolean(readiness.model),
    });
    return createPrimaryIterationOutcome(false);
  }

  const { providerResolution, baseUrl, model } = readiness;

  const persona = task.currentPersona ? await queryLoopPersonaById(task.currentPersona, task.loop) : undefined;
  const systemMessage = await buildTaskSystemMessage(task, persona?.personality);
  const toolDefinitions = await buildOpenRouterToolDefinitions(task.loop);
  const bootstrapUserMessage: OpenRouterMessage = {
    role: `user`,
    content: [
      `Start work on the assigned workgraph item now.`,
      `Task title: ${task.title ?? `Workgraph task`}.`,
      `Use available tools to gather context and make concrete progress without waiting for another user prompt.`,
      `Return a JSON object with key content.`,
      `content should contain only the assistant reply text.`,
    ].join("\n"),
  };
  const messageHistory: OpenRouterMessage[] = systemMessage ? [systemMessage, bootstrapUserMessage] : [bootstrapUserMessage];

  const payload = await fetchOpenRouterChatCompletion(
    {
      baseUrl,
      apiKey: providerResolution.selected.secret,
    },
    {
      model,
      messages: messageHistory,
      ...(toolDefinitions.length > 0 ? { tools: toolDefinitions, toolChoice: `auto` as const } : {}),
      responseFormat: `text`,
      operation: `task-iterate-bootstrap-workgraph-item`,
      context: {
        taskId: task.id,
        loopId: task.loop,
        toolDefinitionCount: toolDefinitions.length,
      },
    },
  );

  const responseMessage = payload.choices?.[0]?.message;
  const assistantText = readPrimaryAssistantContent(responseMessage, `Unable to parse bootstrap assistant response.`);
  const toolCalls = responseMessage?.tool_calls;
  const hasToolCalls = Boolean(toolCalls && toolCalls.length > 0);
  const toolCallsNeedApproval = hasToolCalls && toolCalls?.some((tc) => isProviderToolRequiringApproval(tc.function.name));
  const responseQueueItem: TaskQueueItemInput = {
    type: `message`,
    status: toolCallsNeedApproval ? `awaiting-approval` : hasToolCalls ? `pending` : `completed`,
    value: {
      role: `assistant`,
      content: assistantText,
      ...(toolCalls ? { tool_calls: toolCalls } : {}),
    },
  };

  const appended = await queryAppendQueueItem(task.id, processorId, responseQueueItem);

  if (!appended) {
    throw new Error(`Unable to append bootstrap assistant response for workgraph task.`);
  }

  log.info(`Task iterate bootstrapped workgraph task`, {
    taskId: task.id,
    loopId: task.loop,
    processorId,
    model,
    providerId: providerResolution.selected.assignmentId,
    assistantReplyLength: assistantText.length,
    appendedStatus: responseQueueItem.status,
    toolCallCount: toolCalls?.length ?? 0,
  });

  return createPrimaryIterationOutcome(true);
};

const parseToolCallInput = (value: string): Record<string, unknown> | undefined => {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || Array.isArray(parsed) || typeof parsed !== `object`) {
      return undefined;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

const readToolResultContent = (result: unknown): string => {
  if (typeof result === `string`) {
    return result;
  }

  return JSON.stringify(result ?? null, null, 2);
};

const buildOpenRouterToolDefinitions = async (loopId: string): Promise<OpenRouterTool[]> => {
  const disabledToolNames = await queryLoopDisabledProviderToolsById(loopId);
  return enabledProviderToolDefinitionsFromDisabled(disabledToolNames).map((tool) => ({
    type: `function`,
    function: {
      name: tool.name,
      description: tool.requiresApproval ? `${tool.description} Requires user approval before execution.` : tool.description,
      parameters: providerToolParametersFromInputSchema(tool.inputSchema),
    },
  }));
};

const workgraphIntegrationInstructionPrefix = (context: { workOnLabel: string; workInProgressLabel: string; workDoneLabel: string }): string =>
  [
    `Workgraph Integration Rules:`,
    `- A single workgraph item can be assigned to one or multiple tasks.`,
    `- Tasks do not own workgraph items; workgraph items own task relationships.`,
    `- If you create a new workgraph item, do not continue execution for that new item within the same task.`,
    `- Newly created workgraph items will be assigned to their own task(s) automatically by the system.`,
    `Label Vocabulary (use these exact labels):`,
    `- Work On label: ${context.workOnLabel}`,
    `- Work In Progress (WIP) label: ${context.workInProgressLabel}`,
    `- Work Done label: ${context.workDoneLabel}`,
    `- As soon as execution starts on the assigned workgraph item, add the Work In Progress (WIP) label (${context.workInProgressLabel}) immediately to reflect active ownership.`,
    `- When the task is truly complete, request/perform completion using the completion flow, and then add the Work Done label (${context.workDoneLabel}) so the item state is explicitly closed in work tracking.`,
    `- Keep label usage disciplined and consistent with progress: move from Work On (${context.workOnLabel}) to Work In Progress (${context.workInProgressLabel}) to Work Done (${context.workDoneLabel}) as evidence changes.`,
    `- Keep parent items synchronized with real progress across their descendants: never move a parent to Done while any descendant remains not-Done; advance parent transitions only when descendant state and evidence support it.`,
    `- Prefer disciplined, auditable transitions: reflect reality first (labels, status, dependencies), then transition item states in an order that preserves hierarchy correctness.`,
  ].join("\n");

const readTaskWorkgraphTypeInstruction = async (task: Task): Promise<string | null> => {
  if (!task.workgraphItem) {
    return null;
  }

  const context = await queryTaskWorkgraphItemContext(task.loop, task.id);

  if (!context) {
    return null;
  }

  const instruction = (context.sourceIssueTypeId ? context.typeInstructions[context.sourceIssueTypeId] : undefined) ?? context.typeInstructions[context.itemType] ?? null;
  const blocks = [`Workgraph Item Context:`, `- Workgraph ID: ${context.workgraph}`, `- Workgraph Item ID: ${context.workgraphItem}`, `- Item Type: ${context.itemType}`, workgraphIntegrationInstructionPrefix(context)];

  if (instruction) {
    blocks.push(`Playbook Instruction for this item type:`);
    blocks.push(instruction);
  }

  return blocks.join("\n");
};

const buildTaskSystemMessage = async (task: Task, personaPersonality: string | null | undefined): Promise<OpenRouterMessage | null> => {
  const parts: string[] = [];

  if (typeof personaPersonality === "string" && personaPersonality.trim().length > 0) {
    parts.push(personaPersonality.trim());
  }

  const workgraphInstruction = await readTaskWorkgraphTypeInstruction(task);

  if (workgraphInstruction) {
    parts.push(workgraphInstruction);
  }

  if (parts.length === 0) {
    return null;
  }

  return {
    role: `system`,
    content: parts.join("\n\n"),
  };
};

export const iterateTaskFirstPendingToolCall = async (task: Task, processorId: string): Promise<TaskPrimaryIterationOutcome> => {
  const firstPendingToolCallIndex = task.queue.findIndex((queueItem) => {
    if (queueItem.value.role !== `assistant` || !queueItem.value.tool_calls?.length) {
      return false;
    }

    const needsApproval = queueItem.value.tool_calls.some((tc) => isProviderToolRequiringApproval(tc.function.name));

    // Only execute if explicitly approved, or pending with no approval-required tools.
    return needsApproval ? queueItem.status === `approved` : queueItem.status === `pending`;
  });

  if (firstPendingToolCallIndex < 0) {
    return createPrimaryIterationOutcome(false);
  }

  const firstPendingToolCallMessage = task.queue[firstPendingToolCallIndex];

  if (!firstPendingToolCallMessage?.value.tool_calls?.length) {
    return createPrimaryIterationOutcome(false);
  }

  const requests: ProviderToolRequest[] = firstPendingToolCallMessage.value.tool_calls.map((toolCall) => ({
    tool: toolCall.function.name,
    input: parseToolCallInput(toolCall.function.arguments),
  }));

  const batchResult = await executeProviderToolBatch(
    {
      taskId: task.id,
      loopId: task.loop,
      claimToken: processorId,
    },
    requests,
  );

  for (const [index, toolCall] of firstPendingToolCallMessage.value.tool_calls.entries()) {
    const toolResult = batchResult.results[index];
    const toolQueueItem: TaskQueueItemInput = {
      type: `message`,
      status: `completed`,
      value: {
        role: `tool`,
        content: readToolResultContent(toolResult?.ok ? toolResult.result : { error: toolResult?.error ?? `Tool execution failed.` }),
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
      },
    };

    const appended = await queryAppendQueueItem(task.id, processorId, toolQueueItem);

    if (!appended) {
      throw new Error(`Unable to append task tool response queue item.`);
    }
  }

  await queryTaskQueueItemStatusUpdate(task.id, processorId, firstPendingToolCallMessage.id, `completed`);

  log.info(`Task iterate handled first pending tool-call message`, {
    taskId: task.id,
    loopId: task.loop,
    processorId,
    firstPendingToolCallIndex,
    toolCallCount: firstPendingToolCallMessage.value.tool_calls.length,
    hadToolError: batchResult.hadError,
  });

  // No LLM continuation after enqueue — task blocks on runnerQueue until the runner completes.
  const hasEnqueueRun = firstPendingToolCallMessage.value.tool_calls.some((tc) => tc.function.name === `athena_enqueue_run`);

  if (hasEnqueueRun) {
    console.log(`[task-iterator] task paused — waiting for runner`, { taskId: task.id, loopId: task.loop });
    return createPrimaryIterationOutcome(true);
  }

  const reloadedTask = (await queryTaskGet(task.loop, task.id)) ?? task;

  const persona = task.currentPersona ? await queryLoopPersonaById(task.currentPersona, task.loop) : undefined;
  const systemMessage = await buildTaskSystemMessage(reloadedTask, persona?.personality);
  const queueMessages: OpenRouterMessage[] = reloadedTask.queue.map((queueItem) => queueItem.value);
  const messageHistory: OpenRouterMessage[] = systemMessage ? [systemMessage, ...queueMessages] : queueMessages;

  const readiness = await isTaskReadyForModel(reloadedTask, { minQueueLength: 1 });
  const toolDefinitions = await buildOpenRouterToolDefinitions(task.loop);

  if (!readiness.ready) {
    if (readiness.reason === "queue-empty") {
      return createPrimaryIterationOutcome(true);
    }

    if (readiness.reason === "provider-unavailable") {
      log.warn(`Task iterate skipped LLM continuation after tool calls because no provider selection is available`, {
        taskId: task.id,
        loopId: task.loop,
      });
      return createPrimaryIterationOutcome(true);
    }

    log.warn(`Task iterate skipped LLM continuation after tool calls because provider baseUrl or model is missing`, {
      taskId: task.id,
      loopId: task.loop,
      providerId: readiness.providerResolution.selected?.assignmentId ?? null,
      hasBaseUrl: Boolean(readiness.baseUrl),
      hasModel: Boolean(readiness.model),
    });
    return createPrimaryIterationOutcome(true);
  }

  const { providerResolution, baseUrl, model } = readiness;

  const continuationPromptMessage: OpenRouterMessage = {
    role: `user`,
    content: [`Return a JSON object with key content.`, `content should be the assistant response text only.`].join("\n"),
  };

  const llmPayload = await fetchOpenRouterChatCompletion(
    {
      baseUrl,
      apiKey: providerResolution.selected.secret,
    },
    {
      model,
      messages: [...messageHistory, continuationPromptMessage],
      ...(toolDefinitions.length > 0 ? { tools: toolDefinitions, toolChoice: `auto` as const } : {}),
      responseFormat: `text`,
      operation: `task-iterate-first-pending-tool-call`,
      context: {
        taskId: task.id,
        loopId: task.loop,
        firstPendingToolCallIndex,
        toolDefinitionCount: toolDefinitions.length,
      },
    },
  );

  const llmResponseMessage = llmPayload.choices?.[0]?.message;
  const llmAssistantText = readPrimaryAssistantContent(llmResponseMessage, `Unable to parse task tool-call continuation response.`);
  const llmToolCalls = llmResponseMessage?.tool_calls;
  const llmHasToolCalls = Boolean(llmToolCalls && llmToolCalls.length > 0);
  const llmToolCallsNeedApproval = llmHasToolCalls && llmToolCalls?.some((tc) => isProviderToolRequiringApproval(tc.function.name));
  const continuationQueueItem: TaskQueueItemInput = {
    type: `message`,
    status: llmToolCallsNeedApproval ? `awaiting-approval` : llmHasToolCalls ? `pending` : `completed`,
    value: {
      role: `assistant`,
      content: llmAssistantText,
      ...(llmToolCalls ? { tool_calls: llmToolCalls } : {}),
    },
  };

  const appended = await queryAppendQueueItem(task.id, processorId, continuationQueueItem);

  if (!appended) {
    throw new Error(`Unable to append task assistant response after tool calls.`);
  }

  log.info(`Task iterate sent tool results to LLM`, {
    taskId: task.id,
    loopId: task.loop,
    processorId,
    historyLength: messageHistory.length,
    model,
    providerId: providerResolution.selected.assignmentId,
    assistantReplyLength: llmAssistantText.length,
    appendedStatus: continuationQueueItem.status,
    toolCallCount: llmToolCalls?.length ?? 0,
  });

  return createPrimaryIterationOutcome(true);
};

export const iterateTaskFirstPendingUserMessage = async (task: Task, processorId: string): Promise<TaskPrimaryIterationOutcome> => {
  const firstPendingUserMessageIndex = task.queue.findIndex((queueItem) => queueItem.status === `pending` && queueItem.value.role === `user`);

  if (firstPendingUserMessageIndex < 0) {
    return createPrimaryIterationOutcome(false);
  }

  const firstPendingUserMessage = task.queue[firstPendingUserMessageIndex];

  if (!firstPendingUserMessage) {
    return createPrimaryIterationOutcome(false);
  }

  const queueMessages: OpenRouterMessage[] = task.queue.slice(0, firstPendingUserMessageIndex + 1).map((queueItem) => queueItem.value);

  if (queueMessages.length === 0) {
    return createPrimaryIterationOutcome(false);
  }

  const persona = task.currentPersona ? await queryLoopPersonaById(task.currentPersona, task.loop) : undefined;
  const systemMessage = await buildTaskSystemMessage(task, persona?.personality);
  const messageHistory: OpenRouterMessage[] = systemMessage ? [systemMessage, ...queueMessages] : queueMessages;

  const readiness = await isTaskReadyForModel(task, { minQueueLength: 1 });
  const toolDefinitions = await buildOpenRouterToolDefinitions(task.loop);

  if (!readiness.ready) {
    if (readiness.reason === "queue-empty") {
      return createPrimaryIterationOutcome(false);
    }

    if (readiness.reason === "provider-unavailable") {
      log.warn(`Task iterate skipped LLM call because no provider selection is available`, {
        taskId: task.id,
        loopId: task.loop,
        firstPendingUserMessageIndex,
      });
      return createPrimaryIterationOutcome(false);
    }

    log.warn(`Task iterate skipped LLM call because provider baseUrl or model is missing`, {
      taskId: task.id,
      loopId: task.loop,
      providerId: readiness.providerResolution.selected?.assignmentId ?? null,
      hasBaseUrl: Boolean(readiness.baseUrl),
      hasModel: Boolean(readiness.model),
      firstPendingUserMessageIndex,
    });
    return createPrimaryIterationOutcome(false);
  }

  const { providerResolution, baseUrl, model } = readiness;

  const completionPromptMessage: OpenRouterMessage = {
    role: `user`,
    content: [`Return a JSON object with key content.`, `content should be the assistant response text only.`].join("\n"),
  };

  const payload = await fetchOpenRouterChatCompletion(
    {
      baseUrl,
      apiKey: providerResolution.selected.secret,
    },
    {
      model,
      messages: [...messageHistory, completionPromptMessage],
      ...(toolDefinitions.length > 0 ? { tools: toolDefinitions, toolChoice: `auto` as const } : {}),
      responseFormat: `text`,
      operation: `task-iterate-first-pending-user-message`,
      context: {
        taskId: task.id,
        loopId: task.loop,
        firstPendingUserMessageIndex,
        toolDefinitionCount: toolDefinitions.length,
      },
    },
  );

  const responseMessage = payload.choices?.[0]?.message;
  const assistantText = readPrimaryAssistantContent(responseMessage, `Unable to parse task user-message continuation response.`);
  const toolCalls = responseMessage?.tool_calls;
  const hasToolCalls = Boolean(toolCalls && toolCalls.length > 0);
  const toolCallsNeedApproval = hasToolCalls && toolCalls?.some((tc) => isProviderToolRequiringApproval(tc.function.name));
  const responseQueueItem: TaskQueueItemInput = {
    type: `message`,
    status: toolCallsNeedApproval ? `awaiting-approval` : hasToolCalls ? `pending` : `completed`,
    value: {
      role: `assistant`,
      content: assistantText,
      ...(toolCalls ? { tool_calls: toolCalls } : {}),
    },
  };

  const appended = await queryAppendQueueItem(task.id, processorId, responseQueueItem);

  if (!appended) {
    throw new Error(`Unable to append task assistant response queue item.`);
  }

  await queryTaskQueueItemStatusUpdate(task.id, processorId, firstPendingUserMessage.id, `completed`);

  log.info(`Task iterate sent first pending user message to LLM`, {
    taskId: task.id,
    loopId: task.loop,
    firstPendingUserMessageIndex,
    historyLength: messageHistory.length,
    model,
    providerId: providerResolution.selected.assignmentId,
    assistantReplyLength: assistantText.length,
    appendedStatus: responseQueueItem.status,
    toolCallCount: toolCalls?.length ?? 0,
  });

  return createPrimaryIterationOutcome(true);
};
