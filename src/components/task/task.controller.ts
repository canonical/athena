import { HttpError } from "@components/express/express.errors.js";
import { LoopNotFoundError } from "@components/loop/loop.errors.js";
import { queryLoopById, queryLoopForUser } from "@components/loop/loop.service.js";
import { triggerTaskProcessor } from "./task.processor.js";
import type { Task, TaskAppendUserMessage, TaskCreate, TaskQueueItemInput, TaskToolCallApproval } from "./task.schema.js";
import { queryAppendQueueItem, queryTaskCreate, queryTaskCreateForWorkgraphItem, queryTaskGet, queryTaskList, queryTaskResetProcessorClaim, queryTaskToolCallApprove, queryTaskToolCallReject } from "./task.service.js";

const triggerTaskProcessorAsync = (): void => {
  queueMicrotask(() => {
    triggerTaskProcessor();
  });
};

const requireLoopAccess = async (loopId: string, userId: string): Promise<void> => {
  const loop = await queryLoopForUser(loopId, userId);

  if (!loop) {
    throw new LoopNotFoundError(`Loop not found.`);
  }
};

export const taskList = async (userId: string, loopId: string): Promise<Task[]> => {
  await requireLoopAccess(loopId, userId);

  return queryTaskList(loopId);
};

export const taskGet = async (userId: string, loopId: string, taskId: string): Promise<Task> => {
  await requireLoopAccess(loopId, userId);

  const task = await queryTaskGet(loopId, taskId);

  if (!task) {
    throw new HttpError({ status: 404, message: `Task not found.` });
  }

  return task;
};

export const taskCreate = async (input: TaskCreate, userId?: string): Promise<Task | null> => {
  if (userId) {
    await requireLoopAccess(input.loop, userId);
  } else {
    const loop = await queryLoopById(input.loop);

    if (!loop) {
      throw new LoopNotFoundError(`Loop not found.`);
    }
  }

  if (input.source === `workgraphItem` && input.workgraphItem) {
    const normalizedTitle = typeof input.title === `string` ? input.title : null;

    const createdTask = await queryTaskCreateForWorkgraphItem({
      loop: input.loop,
      workgraphItem: input.workgraphItem,
      title: normalizedTitle,
    });

    if (!createdTask) {
      return null;
    }

    triggerTaskProcessorAsync();
    return createdTask;
  }

  const createdTask = await queryTaskCreate(input);
  triggerTaskProcessorAsync();
  return createdTask;
};

export const taskResetProcessorClaims = async (userId: string, loopId: string, taskId: string): Promise<{ updatedCount: number }> => {
  await requireLoopAccess(loopId, userId);

  const updatedCount = await queryTaskResetProcessorClaim(loopId, taskId);

  return { updatedCount };
};

export const taskAppendUserMessage = async (userId: string, input: TaskAppendUserMessage): Promise<{ appended: boolean }> => {
  await requireLoopAccess(input.loopId, userId);

  const task = await queryTaskGet(input.loopId, input.taskId);

  if (!task) {
    throw new HttpError({ status: 404, message: `Task not found.` });
  }

  const queueItem: TaskQueueItemInput = {
    type: `message`,
    status: `pending`,
    value: {
      role: `user`,
      content: input.content,
    },
  };

  const appended = await queryAppendQueueItem(task.id, task.processorUnit, queueItem, true);

  if (!appended) {
    throw new HttpError({ status: 409, message: `Task queue update conflict.` });
  }

  triggerTaskProcessorAsync();
  return { appended };
};

export const taskApproveToolCall = async (userId: string, input: TaskToolCallApproval): Promise<{ approved: boolean }> => {
  await requireLoopAccess(input.loopId, userId);

  const approved = await queryTaskToolCallApprove(input.loopId, input.taskId, input.queueItemId);

  if (approved) {
    triggerTaskProcessorAsync();
  }

  return { approved };
};

export const taskRejectToolCall = async (userId: string, input: TaskToolCallApproval): Promise<{ rejected: boolean }> => {
  await requireLoopAccess(input.loopId, userId);

  const rejected = await queryTaskToolCallReject(input.loopId, input.taskId, input.queueItemId);

  if (rejected) {
    triggerTaskProcessorAsync();
  }

  return { rejected };
};
