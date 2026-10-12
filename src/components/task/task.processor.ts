import { backgroundJobRegister } from "@components/background-job/background-job.registry.js";
import type { BackgroundJobDefinition } from "@components/background-job/background-job.schema.js";
import { backgroundJobEnqueue } from "@components/background-job/background-job.service.js";
import { log } from "@components/logging/logging.service.js";
import { readyLoops } from "@components/loop/loop.controller.js";
import * as iteratorPrimary from "@components/task/task.iteratorPrimary.js";
import type { Task } from "@components/task/task.schema.js";
import { queryTaskMarkCompleted, queryTaskPick, queryTaskProcessorPing, queryTaskResetProcessorClaim, queryTaskResetStaleProcessorClaims } from "@components/task/task.service.js";
import { z } from "zod";

const taskPingIntervalMs = 5_000;

export const triggerTaskProcessor = (): void => {
  void backgroundJobEnqueue(taskProcessJobDefinition, {}).catch((error) => {
    log.error(`Task processing enqueue failed`, {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
    });
  });
};

const runTaskProcessor = async (processorId: string): Promise<number> => {
  log.info(`Task processor run started`, { processorId });

  try {
    return await processQueue(processorId);
  } finally {
    log.info(`Task processor run finished`, { processorId });
  }
};

const processQueue = async (processorId: string): Promise<number> => {
  log.info(`Task processor queue run started`, { processorId });

  const resetCount = await queryTaskResetStaleProcessorClaims();
  log.info(`Task processor stale claim recovery completed`, { processorId, resetCount });
  let processedCount = 0;

  while (true) {
    const task = await pickTask(processorId);

    if (!task) {
      log.info(`Task processor queue empty`, { processorId });
      return processedCount;
    }

    log.info(`Task processor picked task`, { taskId: task.id, processorId });
    await iterateTask(task, processorId);
    processedCount += 1;
  }
};

const pickTask = async (processorId: string): Promise<Task | null> => {
  const readyLoopIds = await readyLoops();
  const task = await queryTaskPick(processorId, readyLoopIds);

  log.info(`Task processor pick attempted`, {
    processorId,
    pickedTaskId: task?.id ?? null,
    readyLoopCount: readyLoopIds.length,
  });

  return task;
};

const iterateTask = async (task: Task, processorId: string): Promise<void> => {
  log.info(`Task iterate started`, {
    taskId: task.id,
    processorId,
    pingIntervalMs: taskPingIntervalMs,
  });

  let pingInterval: ReturnType<typeof setInterval> | null = null;

  try {
    pingInterval = setInterval(() => {
      void pingTask(task.id, processorId);
    }, taskPingIntervalMs);

    await pingTask(task.id, processorId);

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

const pingTask = async (taskId: string, processorId: string): Promise<void> => {
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

const taskProcessPayloadSchema = z.object({});

const taskProcessJobDefinition: BackgroundJobDefinition<z.infer<typeof taskProcessPayloadSchema>, { processedCount: number }> = {
  name: `task.process`,
  version: 1,
  payloadSchema: taskProcessPayloadSchema,
  queue: { policy: `stately` },
  worker: { localConcurrency: 1 },
  handler: async ({ job }) => ({ processedCount: await runTaskProcessor(job.id) }),
};

backgroundJobRegister(taskProcessJobDefinition);
