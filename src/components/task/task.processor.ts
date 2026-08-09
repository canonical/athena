import { log } from "@components/logging/logging.service.js";
import { readyLoops } from "@components/loop/loop.controller.js";
import * as iteratorPrimary from "@components/task/task.iteratorPrimary.js";
import type { Task } from "@components/task/task.schema.js";
import { queryTaskMarkCompleted, queryTaskPick, queryTaskProcessorPing, queryTaskResetProcessorClaim, queryTaskResetStaleProcessorClaims } from "@components/task/task.service.js";
import { v7 as uuidv7 } from "uuid";

let isProcessing = false;
let processorInterval: ReturnType<typeof setInterval> | null = null;
const taskProcessorIntervalMs = 15_000;
const processorId = uuidv7();
const taskPingIntervalMs = 5_000;

export const startTaskProcessor = (): void => {
  if (processorInterval) {
    log.info(`Task processor start skipped`, { processorId, reason: `already-started` });
    return;
  }

  log.info(`Task processor starting`, {
    processorId,
    processorIntervalMs: taskProcessorIntervalMs,
  });

  triggerTaskProcessor();
  processorInterval = setInterval(triggerTaskProcessor, taskProcessorIntervalMs);
  log.info(`Task processor interval scheduled`, { processorId, processorIntervalMs: taskProcessorIntervalMs });
};

export const triggerTaskProcessor = (): void => {
  if (isProcessing) {
    log.info(`Task processor trigger skipped`, { processorId, reason: `already-processing` });
    return;
  }

  isProcessing = true;
  log.info(`Task processor trigger accepted`, { processorId });

  void runTaskProcessor();
};

const runTaskProcessor = async (): Promise<void> => {
  log.info(`Task processor run started`, { processorId });

  try {
    await processQueue();
  } catch (error) {
    log.error(`Task processor failed`, {
      processorId,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
    });
  } finally {
    isProcessing = false;
    log.info(`Task processor run finished`, { processorId });
  }
};

const processQueue = async (): Promise<void> => {
  log.info(`Task processor queue run started`, { processorId });

  const resetCount = await queryTaskResetStaleProcessorClaims();
  log.info(`Task processor stale claim recovery completed`, { processorId, resetCount });

  while (true) {
    const task = await pickTask();

    if (!task) {
      log.info(`Task processor queue empty`, { processorId });
      return;
    }

    log.info(`Task processor picked task`, { taskId: task.id, processorId });
    await iterateTask(task);
  }
};

export const pickTask = async (): Promise<Task | null> => {
  const readyLoopIds = await readyLoops();
  const task = await queryTaskPick(processorId, readyLoopIds);

  log.info(`Task processor pick attempted`, {
    processorId,
    pickedTaskId: task?.id ?? null,
    readyLoopCount: readyLoopIds.length,
  });

  return task;
};

export const iterateTask = async (task: Task): Promise<void> => {
  log.info(`Task iterate started`, {
    taskId: task.id,
    processorId,
    pingIntervalMs: taskPingIntervalMs,
  });

  let pingInterval: ReturnType<typeof setInterval> | null = null;

  try {
    pingInterval = setInterval(() => {
      void pingTask(task.id);
    }, taskPingIntervalMs);

    await pingTask(task.id);

    const primarySteps: Array<(task: Task, processorId: string) => Promise<iteratorPrimary.TaskPrimaryIterationOutcome>> = [
      iteratorPrimary.iterateTaskAssignCurrentPersona,
      iteratorPrimary.iterateTaskAssignCurrentProvider,
      iteratorPrimary.iterateTaskAssignCurrentModel,
      iteratorPrimary.iterateTaskInitialGreeting,
      iteratorPrimary.iterateTaskBootstrapWorkgraphItem,
      iteratorPrimary.iterateTaskFirstPendingToolCall,
      iteratorPrimary.iterateTaskFirstPendingUserMessage,
    ];

    let primaryOutcome: iteratorPrimary.TaskPrimaryIterationOutcome | null = null;

    for (const stepFn of primarySteps) {
      const stepOutcome = await stepFn(task, processorId);

      if (stepOutcome.handled) {
        primaryOutcome = stepOutcome;
        break;
      }
    }

    if (!primaryOutcome) {
      await queryTaskMarkCompleted(task.loop, task.id, processorId);
    }
  } finally {
    if (pingInterval) {
      clearInterval(pingInterval);
    }

    await queryTaskResetProcessorClaim(task.loop, task.id);
    log.info(`Task iterate released processor claim`, { taskId: task.id, processorId });
    log.info(`Task iterate finished`, { taskId: task.id, processorId });
  }
};

const pingTask = async (taskId: string): Promise<void> => {
  try {
    await queryTaskProcessorPing(taskId, processorId);
    log.info(`Task processor ping updated`, { taskId, processorId });
  } catch (error) {
    log.error(`Task processor ping failed`, {
      taskId,
      processorId,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
    });
  }
};
