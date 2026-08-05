import { queryTaskById } from "@components/task/task.service.js";
import type { TaskPayload } from "@components/task/task.schema.js";
import type { ProviderToolExecutionContext } from "./tool.schema.js";

const loadTaskForUpdate = async (taskId: string) => {
  const task = await queryTaskById(taskId);

  if (!task) {
    throw new Error("Task not found.");
  }

  return task;
};

export const executeAthenaEmitBlocker = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  await loadTaskForUpdate(context.taskId);
  const blocker = typeof input?.blocker === "string" && input.blocker.trim().length > 0 ? input.blocker.trim() : "Provider emitted blocker.";

  return {
    intent: "emit-blocker",
    blocker,
  };
};

export const executeAthenaMarkComplete = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  await loadTaskForUpdate(context.taskId);
  const note = typeof input?.note === "string" && input.note.trim().length > 0 ? input.note.trim() : "Provider marked task complete.";

  return {
    intent: "mark-complete",
    note,
  };
};

export const executeAthenaRequestChat = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  await loadTaskForUpdate(context.taskId);
  const prompt = typeof input?.prompt === "string" ? input.prompt.trim() : "";

  if (prompt.length === 0) {
    throw new Error("athena_request_chat requires a non-empty prompt.");
  }

  return {
    intent: "request-chat",
    prompt,
  };
};
