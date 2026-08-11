import { log } from "@components/logging/logging.service.js";
import { triggerTaskProcessor } from "@components/task/task.processor.js";
import { queryAppendQueueItem } from "@components/task/task.service.js";
import { v7 as uuidv7 } from "uuid";
import { pollCopilotAgentTask, submitCopilotAgentTask } from "./runner.copilot.adapter.js";
import { queryRunnerQueueClaimNext, queryRunnerQueueListClaimed, queryRunnerQueueMarkFailed, queryRunnerQueueSetExternalTaskId, queryRunnerQueueSubmitResult } from "./runner.queue.service.js";
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
      console.log(`[runner-queue-consumer] claimed item has no externalTaskId yet — skipping`, { id: item.id });
      continue;
    }

    const apiKey = await queryRunnerDecryptCredential(item.runner);

    if (!apiKey) {
      console.log(`[runner-queue-consumer] runner credential not found — marking failed`, { id: item.id, runnerId: item.runner });
      await queryRunnerQueueMarkFailed(item.id, consumerId, `runner-credential-not-found`);
      continue;
    }

    const { done, succeeded, result } = await (async () => {
      try {
        return await pollCopilotAgentTask(apiKey, item.repository, item.externalTaskId as string);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`[runner-queue-consumer] poll error`, { id: item.id, error: msg });
        return { done: false, succeeded: false, result: `` };
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
      await queryRunnerQueueMarkFailed(item.id, consumerId, result);
      await appendRunnerResultToTask(item.task, item.loop, `Runner task failed or was cancelled. Details: ${result}`);
      triggerTaskProcessor();
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
    await queryRunnerQueueMarkFailed(item.id, consumerId, `runner-credential-not-found`);
    return;
  }

  try {
    const fullPrompt = [item.prompt, `Plan:\n${item.plan}`].join(`\n\n`);
    const { externalTaskId } = await submitCopilotAgentTask(apiKey, item.repository, fullPrompt);
    await queryRunnerQueueSetExternalTaskId(item.id, consumerId, externalTaskId);
    console.log(`[runner-queue-consumer] agent task submitted`, { id: item.id, externalTaskId, repository: item.repository });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[runner-queue-consumer] agent task submission failed`, { id: item.id, error: msg });
    await queryRunnerQueueMarkFailed(item.id, consumerId, `submission-failed: ${msg}`);
  }
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
