import type { OpenRouterMessage } from "@components/openrouter/openrouter.schema.js";
import { readOpenRouterAssistantText } from "@components/openrouter/openrouter.service.js";
import { queryLoopPersonaById, queryLoopPersonaList } from "@components/persona/persona.service.js";
import { ProviderChat } from "@components/provider/provider.chat.service.js";
import { resolveTaskProviderContext } from "@components/task/task.iteratorUtilities.js";
import type { TaskQueueItemInput } from "@components/task/task.schema.js";
import { queryAppendQueueItem, queryTaskAssignWorkgraphItem, queryTaskCompactQueue, queryTaskDefineObjective, queryTaskDefineTitle, queryTaskGet, queryTaskMarkCompleted } from "@components/task/task.service.js";
import { queryLoopWorkgraphItemByIdInLoop } from "@components/workgraph/workgraph.pg.service.js";
import type { ProviderToolExecutionContext } from "./tool.schema.js";

export const executeAthenaMarkComplete = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  if (!context.claimToken) {
    throw new Error("athena_mark_complete requires an active processor claim.");
  }

  const note = typeof input?.note === "string" && input.note.trim().length > 0 ? input.note.trim() : null;
  const marked = await queryTaskMarkCompleted(context.loopId, context.taskId, context.claimToken, false);

  return {
    marked,
    note,
  };
};

export const executeAthenaCompactQueue = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const summary = typeof input?.summary === "string" ? input.summary.trim() : "";

  if (summary.length === 0) {
    throw new Error("athena_compact_queue requires a non-empty summary.");
  }

  if (!context.claimToken) {
    throw new Error("athena_compact_queue requires an active processor claim.");
  }

  const compacted = await queryTaskCompactQueue(context.loopId, context.taskId, context.claimToken, summary);

  return {
    intent: "compact-queue",
    compacted,
  };
};

export const executeAthenaDefineObjective = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const objective = typeof input?.objective === "string" ? input.objective.trim() : "";

  if (objective.length === 0) {
    throw new Error("athena_define_objective requires a non-empty objective.");
  }

  if (!context.claimToken) {
    throw new Error("athena_define_objective requires an active processor claim.");
  }

  const updated = await queryTaskDefineObjective(context.loopId, context.taskId, context.claimToken, objective);

  return {
    intent: "define-objective",
    updated,
    objective,
  };
};

export const executeAthenaDefineTitle = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const title = typeof input?.title === "string" ? input.title.trim() : "";

  if (title.length === 0) {
    throw new Error("athena_define_title requires a non-empty title.");
  }

  if (!context.claimToken) {
    throw new Error("athena_define_title requires an active processor claim.");
  }

  const updated = await queryTaskDefineTitle(context.loopId, context.taskId, context.claimToken, title);

  return {
    intent: "define-title",
    updated,
    title,
  };
};

export const executeAthenaGetObjective = async (context: ProviderToolExecutionContext): Promise<unknown> => {
  const task = await queryTaskGet(context.loopId, context.taskId);

  return {
    objective: task?.currentObjective ?? null,
  };
};

export const executeAthenaGetTitle = async (context: ProviderToolExecutionContext): Promise<unknown> => {
  const task = await queryTaskGet(context.loopId, context.taskId);

  return {
    title: task?.title ?? null,
  };
};

export const executeAthenaListPersonas = async (context: ProviderToolExecutionContext): Promise<unknown> => {
  const personas = await queryLoopPersonaList(context.loopId);

  return {
    personas: personas.map((p) => ({ id: p.id, displayName: p.displayName, role: p.role })),
  };
};

export const executeAthenaAssignToWorkgraphItem = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const itemId = typeof input?.item === "string" ? input.item.trim() : "";

  if (!itemId) {
    throw new Error("athena_assign_to_workgraph_item requires item.");
  }

  if (!context.claimToken) {
    throw new Error("athena_assign_to_workgraph_item requires an active processor claim.");
  }

  const item = await queryLoopWorkgraphItemByIdInLoop(context.loopId, itemId);

  if (!item) {
    throw new Error(`Workgraph item ${itemId} was not found in this loop.`);
  }

  const assigned = await queryTaskAssignWorkgraphItem(context.loopId, context.taskId, item.id, item.title ?? null);

  if (!assigned) {
    throw new Error("Unable to assign task to the selected workgraph item.");
  }

  return {
    assigned: true,
    item: item.id,
    itemType: item.itemType,
    title: item.title,
  };
};

export const executeAthenaListModels = async (context: ProviderToolExecutionContext): Promise<unknown> => {
  const task = await queryTaskGet(context.loopId, context.taskId);

  if (!task) {
    return { models: [], defaultModel: null };
  }

  const providerContext = await resolveTaskProviderContext(task);

  if (!providerContext.providerResolution.selected || !providerContext.baseUrl) {
    return { models: [], defaultModel: null };
  }

  const providerChat = new ProviderChat({
    providerType: providerContext.providerResolution.selected.definitionType,
    baseUrl: providerContext.baseUrl,
    apiKey: providerContext.providerResolution.selected.secret,
  });
  const allModels = await providerChat.listModels();

  const enabledIds = new Set(providerContext.providerResolution.selected.enabledModels);
  const models = enabledIds.size > 0 ? allModels.filter((m) => enabledIds.has(m.id)) : allModels;

  return {
    models,
    defaultModel: providerContext.providerResolution.selected.defaultModel,
  };
};

export const executeAthenaAskOtherPersona = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const personaId = typeof input?.personaId === "string" ? input.personaId.trim() : "";
  const model = typeof input?.model === "string" ? input.model.trim() : "";
  const summary = typeof input?.summary === "string" ? input.summary.trim() : "";
  const prompt = typeof input?.prompt === "string" ? input.prompt.trim() : "";

  if (!personaId) throw new Error("athena_ask_other_persona requires personaId.");
  if (!model) throw new Error("athena_ask_other_persona requires model.");
  if (!summary) throw new Error("athena_ask_other_persona requires summary.");
  if (!prompt) throw new Error("athena_ask_other_persona requires prompt.");
  if (!context.claimToken) throw new Error("athena_ask_other_persona requires an active processor claim.");

  const persona = await queryLoopPersonaById(personaId, context.loopId);

  if (!persona) {
    throw new Error(`Persona ${personaId} is not available in this loop.`);
  }

  const task = await queryTaskGet(context.loopId, context.taskId);

  if (!task) {
    throw new Error("Task not found.");
  }

  const providerContext = await resolveTaskProviderContext(task);

  if (!providerContext.providerResolution.selected || !providerContext.baseUrl) {
    throw new Error("No provider available for persona consultation.");
  }

  const messages: OpenRouterMessage[] = [
    { role: `system`, content: persona.personality },
    { role: `user`, content: `Context summary:\n${summary}\n\n${prompt}` },
  ];

  const payload = await new ProviderChat({
    providerType: providerContext.providerResolution.selected.definitionType,
    baseUrl: providerContext.baseUrl,
    apiKey: providerContext.providerResolution.selected.secret,
  }).complete({
    model,
    messages,
    responseFormat: `text`,
    operation: `athena-ask-other-persona`,
    context: { taskId: context.taskId, loopId: context.loopId, personaId },
  });

  const responseText = readOpenRouterAssistantText(payload.choices?.[0]?.message).trim();

  if (!responseText) {
    throw new Error("Persona consultation returned an empty response.");
  }

  const queueItem: TaskQueueItemInput = {
    type: `message`,
    status: `completed`,
    persona: personaId,
    value: { role: `assistant`, content: responseText },
  };

  await queryAppendQueueItem(context.taskId, context.claimToken, queueItem);

  return {
    personaId,
    personaDisplayName: persona.displayName,
    response: responseText,
  };
};
