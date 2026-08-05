import { randomUUID } from "node:crypto";
import { queryTaskById, queryTaskUpdate } from "@components/task/task.service.js";
import type { TaskPayload, TimelineEntry } from "@components/task/task.schema.js";
import type { ProviderToolExecutionContext } from "./tool.schema.js";

const appendTimelineEntry = (payload: TaskPayload, entry: TimelineEntry): TaskPayload => {
  const timeline = Array.isArray(payload.timeline) ? payload.timeline : [];
  return {
    ...payload,
    timeline: [...timeline, entry],
  };
};

const loadTaskForUpdate = async (taskId: string) => {
  const task = await queryTaskById(taskId);

  if (!task) {
    throw new Error("Task not found.");
  }

  return task;
};

export const executeAthenaTaskClaim = async (context: ProviderToolExecutionContext): Promise<unknown> => {
  const task = await loadTaskForUpdate(context.taskId);
  return {
    id: task.id,
    claimToken: task.claimToken,
    claimOwner: task.claimOwner,
    status: task.status,
    phase: task.phase,
  };
};

export const executeAthenaTaskUpdateState = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const task = await loadTaskForUpdate(context.taskId);
  const contextText = typeof input?.context === "string" && input.context.trim().length > 0 ? input.context.trim() : task.context;
  const blocker = input?.blocker === null ? null : typeof input?.blocker === "string" ? input.blocker : task.blocker;

  const updated = await queryTaskUpdate({
    id: task.id,
    context: contextText,
    blocker,
    expectedClaimToken: context.claimToken ?? undefined,
  });

  return {
    id: updated.id,
    status: updated.status,
    phase: updated.phase,
    blocker: updated.blocker,
    context: updated.context,
  };
};

export const executeAthenaTaskAppendTimeline = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const task = await loadTaskForUpdate(context.taskId);
  const type = typeof input?.type === "string" ? input.type.trim() : "system-action-result";
  const actor = typeof input?.actor === "string" && input.actor.trim().length > 0 ? input.actor.trim() : "provider-tool";
  const data = input?.data && typeof input.data === "object" && !Array.isArray(input.data) ? input.data : { message: "timeline update" };

  const nextPayload = appendTimelineEntry(task.payload, {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type: type as TimelineEntry["type"],
    actor,
    data: data as Record<string, unknown>,
  });

  const updated = await queryTaskUpdate({
    id: task.id,
    payload: nextPayload,
    expectedClaimToken: context.claimToken ?? undefined,
  });

  return {
    id: updated.id,
    timelineCount: Array.isArray(updated.payload.timeline) ? updated.payload.timeline.length : 0,
  };
};

export const executeAthenaTaskLinkWorkgraphItem = async (_context: ProviderToolExecutionContext, _input: Record<string, unknown> | undefined): Promise<unknown> => {
  return {
    linked: false,
    reason: "Not implemented in this phase.",
  };
};

export const executeAthenaEmitBlocker = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const task = await loadTaskForUpdate(context.taskId);
  const blocker = typeof input?.blocker === "string" && input.blocker.trim().length > 0 ? input.blocker.trim() : "Provider emitted blocker.";

  const updated = await queryTaskUpdate({
    id: task.id,
    status: "blocked",
    phase: "execution",
    blocker,
    context: blocker,
    expectedClaimToken: context.claimToken ?? undefined,
  });

  return {
    id: updated.id,
    status: updated.status,
    blocker: updated.blocker,
  };
};

export const executeAthenaMarkComplete = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const task = await loadTaskForUpdate(context.taskId);
  const note = typeof input?.note === "string" && input.note.trim().length > 0 ? input.note.trim() : "Provider marked task complete.";

  const updated = await queryTaskUpdate({
    id: task.id,
    status: "completed",
    phase: "done",
    blocker: null,
    completedAt: new Date().toISOString(),
    context: note,
    expectedClaimToken: context.claimToken ?? undefined,
  });

  return {
    id: updated.id,
    status: updated.status,
    phase: updated.phase,
    completedAt: updated.completedAt,
  };
};
