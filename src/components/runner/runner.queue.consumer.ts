import { log } from "@components/logging/logging.service.js";
import { triggerTaskProcessor } from "@components/task/task.processor.js";
import { queryAppendQueueItem } from "@components/task/task.service.js";
import { delay } from "@components/utilities/timers.js";
import { v7 as uuidv7 } from "uuid";
import { CopilotAgentTaskIdMissingError, pollCopilotAgentTask, submitCopilotAgentTask } from "./runner.copilot.adapter.js";
import { queryRunnerQueueClaimNext, queryRunnerQueueListClaimed, queryRunnerQueueMarkFailed, queryRunnerQueueSetExternalTaskId, queryRunnerQueueSubmitResult } from "./runner.queue.service.js";
import type { RunnerQueueItem } from "./runner.schema.js";
import { queryRunnerDecryptCredential } from "./runner.service.js";

let isConsuming = false;
let consumerInterval: ReturnType<typeof setInterval> | null = null;
const runnerQueueConsumerIntervalMs = 15_000;
const consumerId = uuidv7();

export const startRunnerQueueConsumer = (): void => {
  if (consumerInterval) {
    log.info(`Runner queue consumer start skipped`, { consumerId, reason: `already-started` });
    return;
  }

  log.info(`Runner queue consumer starting`, { consumerId, intervalMs: runnerQueueConsumerIntervalMs });

  triggerRunnerQueueConsumer();
  consumerInterval = setInterval(triggerRunnerQueueConsumer, runnerQueueConsumerIntervalMs);
  log.info(`Runner queue consumer interval scheduled`, { consumerId, intervalMs: runnerQueueConsumerIntervalMs });
};

export const triggerRunnerQueueConsumer = (): void => {
  if (isConsuming) {
    log.info(`Runner queue consumer trigger skipped`, { consumerId, reason: `already-consuming` });
    return;
  }

  isConsuming = true;
  log.info(`Runner queue consumer trigger accepted`, { consumerId });

  void runConsumerCycle();
};

const runConsumerCycle = async (): Promise<void> => {
  console.log(`[runner-queue-consumer] cycle started`, { consumerId });

  try {
    await checkClaimedItems();
    await claimAndSubmitNext();
  } catch (error) {
    log.error(`Runner queue consumer cycle failed`, {
      consumerId,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
    });
  } finally {
    isConsuming = false;
    console.log(`[runner-queue-consumer] cycle finished`, { consumerId });
  }
};

// Phase 1: poll GitHub for all items already claimed by this consumer.
const checkClaimedItems = async (): Promise<void> => {
  const claimedItems = await queryRunnerQueueListClaimed(consumerId);

  console.log(`[runner-queue-consumer] checking claimed items`, { consumerId, count: claimedItems.length });

  for (const item of claimedItems) {
    if (!item.externalTaskId) {
      console.log(`[runner-queue-consumer] claimed item has no externalTaskId — marking failed`, { id: item.id });
      await failRunnerQueueItem(item, `external-task-id-missing`, `Runner task did not provide an external task ID.`);
      continue;
    }

    const apiKey = await queryRunnerDecryptCredential(item.runner);

    if (!apiKey) {
      console.log(`[runner-queue-consumer] runner credential not found — marking failed`, { id: item.id, runnerId: item.runner });
      await failRunnerQueueItem(item, `runner-credential-not-found`, `Runner credential was not found.`);
      continue;
    }

    const { done, succeeded, result } = await (async () => {
      try {
        return await runWithRetries(`poll`, () => pollCopilotAgentTask(apiKey, item.repository, item.externalTaskId as string));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`[runner-queue-consumer] poll error`, { id: item.id, error: msg });
        return { done: true, succeeded: false, result: `Runner task polling failed. Details: ${msg}` };
      }
    })();

    if (!done) {
      console.log(`[runner-queue-consumer] agent task still in progress`, { id: item.id, externalTaskId: item.externalTaskId });
      continue;
    }

    if (succeeded) {
      await queryRunnerQueueSubmitResult(item.id, consumerId, result);
      await appendRunnerResultToTask(item.task, item.loop, result);
      triggerTaskProcessor();
      console.log(`[runner-queue-consumer] agent task completed — task resumed`, { id: item.id, externalTaskId: item.externalTaskId });
    } else {
      await failRunnerQueueItem(item, result, `Runner task failed or was cancelled. Details: ${result}`);
      console.log(`[runner-queue-consumer] agent task failed`, { id: item.id, externalTaskId: item.externalTaskId });
    }
  }
};

// Phase 2: claim the next pending item and submit it to GitHub.
const claimAndSubmitNext = async (): Promise<void> => {
  const item = await queryRunnerQueueClaimNext(`github-copilot-cloud`, consumerId);

  if (!item) {
    console.log(`[runner-queue-consumer] nothing to process`, { consumerId });
    return;
  }

  console.log(`[runner-queue-consumer] item claimed`, {
    id: item.id,
    taskId: item.task,
    loopId: item.loop,
    repository: item.repository,
    promptLength: item.prompt.length,
    planLength: item.plan.length,
  });

  const apiKey = await queryRunnerDecryptCredential(item.runner);

  if (!apiKey) {
    console.log(`[runner-queue-consumer] runner credential not found — marking failed`, { id: item.id });
    await failRunnerQueueItem(item, `runner-credential-not-found`, `Runner credential was not found.`);
    return;
  }

  try {
    const fullPrompt = [item.prompt, `Plan:\n${item.plan}`].join(`\n\n`);
    const { externalTaskId } = await runWithRetries(`submit`, () => submitCopilotAgentTask(apiKey, item.repository, fullPrompt));
    const persisted = await queryRunnerQueueSetExternalTaskId(item.id, consumerId, externalTaskId);
    if (!persisted) {
      await failRunnerQueueItem(item, `external-task-id-persist-failed`, `Runner task was submitted, but Athena could not persist its external task ID.`);
      return;
    }
    console.log(`[runner-queue-consumer] agent task submitted`, { id: item.id, externalTaskId, repository: item.repository });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[runner-queue-consumer] agent task submission failed`, { id: item.id, error: msg });
    await failRunnerQueueItem(item, `submission-failed: ${msg}`, `Runner task submission failed. Details: ${msg}`);
  }
};

const failRunnerQueueItem = async (item: RunnerQueueItem, error: string, taskMessage: string): Promise<void> => {
  await queryRunnerQueueMarkFailed(item.id, consumerId, error);
  await appendRunnerResultToTask(item.task, item.loop, taskMessage);
  triggerTaskProcessor();
};

const runWithRetries = async <T>(operation: string, action: () => Promise<T>): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (error instanceof CopilotAgentTaskIdMissingError) {
        throw error;
      }
      if (attempt < 3) {
        console.log(`[runner-queue-consumer] runner API ${operation} failed — retrying`, { attempt, nextAttempt: attempt + 1 });
        await delay(1_000);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

// Appends the runner result as a pending user message so the LLM can act on it.
const appendRunnerResultToTask = async (taskId: string, loopId: string, result: string): Promise<void> => {
  const queueItem = {
    type: `message` as const,
    status: `pending` as const,
    value: { role: `user` as const, content: `Runner task completed. Result:\n${result}` },
  };

  await queryAppendQueueItem(taskId, null, queueItem, true);
  console.log(`[runner-queue-consumer] result appended to task`, { taskId, loopId });
};
