import { log } from "@components/logging/logging.service.js";
import { v7 as uuidv7 } from "uuid";
import { queryRunnerQueueClaimNext, queryRunnerQueueMarkFailed } from "./runner.queue.service.js";

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
    await processNextItem();
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

const processNextItem = async (): Promise<void> => {
  const item = await queryRunnerQueueClaimNext(`github-copilot-cloud`, consumerId);

  if (!item) {
    console.log(`[runner-queue-consumer] nothing to process`, { consumerId });
    return;
  }

  console.log(`[runner-queue-consumer] item claimed`, {
    id: item.id,
    taskId: item.task,
    loopId: item.loop,
    runnerType: `github-copilot-cloud`,
    promptLength: item.prompt.length,
    planLength: item.plan.length,
  });

  // Stub: GitHub Copilot Cloud API integration is deferred to the next iteration.
  console.log(`[runner-queue-consumer] GitHub Copilot Cloud API not yet integrated — marking failed`, {
    id: item.id,
    prompt: item.prompt,
    plan: item.plan,
  });

  await queryRunnerQueueMarkFailed(item.id, consumerId, `github-copilot-cloud-not-yet-integrated`);
  console.log(`[runner-queue-consumer] item marked failed (stub)`, { id: item.id });
};
