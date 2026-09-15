import { HttpError } from "@components/express/express.errors.js";
import { LoopNotFoundError } from "@components/loop/loop.errors.js";
import { queryLoopById, queryLoopForUser } from "@components/loop/loop.service.js";
import { queryLoopWorkgraphItemByIdInLoop } from "@components/workgraph/workgraph.pg.service.js";
import { triggerTaskProcessor } from "./task.processor.js";
import type { Task, TaskAppendUserMessage, TaskCreate, TaskQueueItemInput, TaskToolCallApproval } from "./task.schema.js";
import {
  queryAppendQueueItem,
  queryTaskAssignedWorkgraphItem,
  queryTaskAssignWorkgraphItem,
  queryTaskCreate,
  queryTaskCreateForWorkgraphItem,
  queryTaskGet,
  queryTaskList,
  queryTaskToolCallApprove,
  queryTaskToolCallReject,
  queryTaskUpdateObjectiveByUser,
  queryTaskUpdateTitleByUser,
} from "./task.service.js";

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

export const taskAppendUserMessage = async (user: { id: string; name: string }, input: TaskAppendUserMessage): Promise<{ appended: boolean }> => {
  await requireLoopAccess(input.loopId, user.id);

  const task = await queryTaskGet(input.loopId, input.taskId);

  if (!task) {
    throw new HttpError({ status: 404, message: `Task not found.` });
  }

  const queueItem: TaskQueueItemInput = {
    type: `message`,
    status: `pending`,
    userId: user.id,
    userName: user.name,
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

export const taskApproveToolCall = async (user: { id: string; name: string }, input: TaskToolCallApproval): Promise<{ approved: boolean }> => {
  await requireLoopAccess(input.loopId, user.id);

  const approved = await queryTaskToolCallApprove(input.loopId, input.taskId, input.queueItemId);

  if (approved && input.message) {
    const task = await queryTaskGet(input.loopId, input.taskId);

    if (task) {
      const messageQueueItem: TaskQueueItemInput = {
        type: `message`,
        // completed so the tool-result LLM continuation picks it up as context, not a new user turn
        status: `completed`,
        userId: user.id,
        userName: user.name,
        value: { role: `user`, content: `Tool call approved. User note: ${input.message}` },
      };
      await queryAppendQueueItem(task.id, task.processorUnit, messageQueueItem, true);
    }
  }

  if (approved) {
    triggerTaskProcessorAsync();
  }

  return { approved };
};

export const taskGetAssignedWorkgraphItem = async (userId: string, loopId: string, taskId: string): Promise<{ id: string; title: string | null; itemKey: string | null; itemType: string } | null> => {
  await requireLoopAccess(loopId, userId);
  return queryTaskAssignedWorkgraphItem(loopId, taskId);
};

export const taskUpdateTitle = async (userId: string, loopId: string, taskId: string, title: string): Promise<{ updated: boolean }> => {
  await requireLoopAccess(loopId, userId);
  const updated = await queryTaskUpdateTitleByUser(loopId, taskId, title);
  return { updated };
};

export const taskUpdateObjective = async (userId: string, loopId: string, taskId: string, objective: string): Promise<{ updated: boolean }> => {
  await requireLoopAccess(loopId, userId);
  const updated = await queryTaskUpdateObjectiveByUser(loopId, taskId, objective);
  return { updated };
};

export const taskAssignWorkgraphItem = async (userId: string, loopId: string, taskId: string, itemId: string): Promise<{ assigned: boolean }> => {
  await requireLoopAccess(loopId, userId);
  const item = await queryLoopWorkgraphItemByIdInLoop(loopId, itemId);

  if (!item) {
    throw new HttpError({ status: 404, message: `Workgraph item not found in this loop.` });
  }

  const assigned = await queryTaskAssignWorkgraphItem(loopId, taskId, item.id, item.title ?? null);

  if (assigned) {
    triggerTaskProcessorAsync();
  }

  return { assigned };
};

export const taskRejectToolCall = async (user: { id: string; name: string }, input: TaskToolCallApproval): Promise<{ rejected: boolean }> => {
  await requireLoopAccess(input.loopId, user.id);

  const rejected = await queryTaskToolCallReject(input.loopId, input.taskId, input.queueItemId);

  if (rejected && input.message) {
    const task = await queryTaskGet(input.loopId, input.taskId);

    if (task) {
      const messageQueueItem: TaskQueueItemInput = {
        type: `message`,
        status: `pending`,
        userId: user.id,
        userName: user.name,
        value: { role: `user`, content: `Tool call rejected. User note: ${input.message}` },
      };
      await queryAppendQueueItem(task.id, task.processorUnit, messageQueueItem, true);
    }
  }

  if (rejected) {
    triggerTaskProcessorAsync();
  }

  return { rejected };
};
