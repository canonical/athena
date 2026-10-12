import { backgroundJobRegister } from "@components/background-job/background-job.registry.js";
import type { BackgroundJobDefinition } from "@components/background-job/background-job.schema.js";
import { backgroundJobEnqueue } from "@components/background-job/background-job.service.js";
import { triggerTaskProcessor } from "@components/task/task.processor.js";
import { delay } from "@components/utilities/timers.js";
import { z } from "zod";
import { pollCopilotAgentTask, submitCopilotAgentTask } from "./runner.copilot.adapter.js";
import { CopilotAgentTaskIdMissingError } from "./runner.errors.js";
import { queryRunnerQueueById, queryRunnerQueueFinalize, queryRunnerQueueListActive, queryRunnerQueueMarkSubmitting, queryRunnerQueueStoreExternalTaskId } from "./runner.queue.service.js";
import { queryRunnerDecryptCredential } from "./runner.service.js";

const runnerQueueJobPayloadSchema = z.object({ runnerQueueId: z.uuid() });
type RunnerQueueJobPayload = z.infer<typeof runnerQueueJobPayloadSchema>;
const runnerPollDelaySeconds = 15;

const runWithRetries = async <T>(action: () => Promise<T>): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;

      if (error instanceof CopilotAgentTaskIdMissingError || attempt === 3) {
        throw error;
      }

      await delay(1_000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const enqueueRunnerSubmit = async (runnerQueueId: string) => backgroundJobEnqueue(runnerSubmitJobDefinition, { runnerQueueId }, { singletonKey: runnerQueueId });
const enqueueRunnerPoll = async (runnerQueueId: string) => backgroundJobEnqueue(runnerPollJobDefinition, { runnerQueueId }, { singletonKey: runnerQueueId, startAfter: runnerPollDelaySeconds });

const finalizeRunner = async (runnerQueueId: string, status: `completed` | `failed`, result: string): Promise<boolean> => {
  const taskMessage = status === `completed` ? `Runner task completed. Result:\n${result}` : `Runner task failed. Details:\n${result}`;
  const finalized = await queryRunnerQueueFinalize(runnerQueueId, status, result, taskMessage);

  if (finalized) {
    triggerTaskProcessor();
  }

  return finalized;
};

export const runnerSubmitJobDefinition: BackgroundJobDefinition<RunnerQueueJobPayload, { skipped: boolean }> = {
  name: `runner.submit`,
  version: 1,
  payloadSchema: runnerQueueJobPayloadSchema,
  queue: { policy: `stately` },
  handler: async ({ payload }) => {
    const item = await queryRunnerQueueById(payload.runnerQueueId);

    if (!item || item.status === `completed` || item.status === `failed`) {
      return { skipped: true };
    }

    if (item.status === `claimed` && item.externalTaskId) {
      await enqueueRunnerPoll(item.id);
      return { skipped: true };
    }

    if (item.status === `claimed`) {
      await finalizeRunner(item.id, `failed`, `Runner submission was interrupted before its external task ID was persisted; the external task may still exist.`);
      return { skipped: true };
    }

    const apiKey = await queryRunnerDecryptCredential(item.runner);

    if (!apiKey) {
      await finalizeRunner(item.id, `failed`, `Runner credential was not found.`);
      return { skipped: false };
    }

    const fullPrompt = [item.prompt, `Plan:\n${item.plan}`, `Athena execution reference: ${item.id}`].join(`\n\n`);
    const markedSubmitting = await queryRunnerQueueMarkSubmitting(item.id);

    if (!markedSubmitting) {
      return { skipped: true };
    }

    let externalTaskId: string;

    try {
      ({ externalTaskId } = await runWithRetries(() => submitCopilotAgentTask(apiKey, item.repository, fullPrompt)));
    } catch (error) {
      await finalizeRunner(item.id, `failed`, error instanceof Error ? error.message : String(error));
      return { skipped: false };
    }

    const persisted = await queryRunnerQueueStoreExternalTaskId(item.id, externalTaskId);

    if (!persisted) {
      await finalizeRunner(item.id, `failed`, `Runner task was submitted, but Athena could not persist its external task ID.`);
      return { skipped: false };
    }

    await enqueueRunnerPoll(item.id);
    return { skipped: false };
  },
};

export const runnerPollJobDefinition: BackgroundJobDefinition<RunnerQueueJobPayload, { done: boolean; skipped: boolean }> = {
  name: `runner.poll`,
  version: 1,
  payloadSchema: runnerQueueJobPayloadSchema,
  queue: { policy: `stately` },
  handler: async ({ payload }) => {
    const item = await queryRunnerQueueById(payload.runnerQueueId);

    if (!item || item.status === `completed` || item.status === `failed`) {
      return { done: true, skipped: true };
    }

    if (item.status === `pending`) {
      await enqueueRunnerSubmit(item.id);
      return { done: false, skipped: true };
    }

    if (!item.externalTaskId) {
      await finalizeRunner(item.id, `failed`, `Runner task did not provide an external task ID.`);
      return { done: true, skipped: false };
    }

    const apiKey = await queryRunnerDecryptCredential(item.runner);

    if (!apiKey) {
      await finalizeRunner(item.id, `failed`, `Runner credential was not found.`);
      return { done: true, skipped: false };
    }

    let outcome: Awaited<ReturnType<typeof pollCopilotAgentTask>>;

    try {
      outcome = await runWithRetries(() => pollCopilotAgentTask(apiKey, item.repository, item.externalTaskId as string));
    } catch (error) {
      await finalizeRunner(item.id, `failed`, error instanceof Error ? error.message : String(error));
      return { done: true, skipped: false };
    }

    if (!outcome.done) {
      await enqueueRunnerPoll(item.id);
      return { done: false, skipped: false };
    }

    await finalizeRunner(item.id, outcome.succeeded ? `completed` : `failed`, outcome.result);
    return { done: true, skipped: false };
  },
};

const runnerReconcilePayloadSchema = z.object({});

export const runnerReconcileJobDefinition: BackgroundJobDefinition<z.infer<typeof runnerReconcilePayloadSchema>, { reconciledCount: number }> = {
  name: `runner.reconcile`,
  version: 1,
  payloadSchema: runnerReconcilePayloadSchema,
  queue: { policy: `exclusive` },
  schedule: {
    cron: `*/15 * * * * *`,
    payload: {},
    options: { key: `runner-reconciliation` },
  },
  worker: { localConcurrency: 1 },
  handler: async () => {
    const items = await queryRunnerQueueListActive(`github-copilot-cloud`);

    for (const item of items) {
      if (item.status === `pending`) {
        await enqueueRunnerSubmit(item.id);
      } else {
        await enqueueRunnerPoll(item.id);
      }
    }

    return { reconciledCount: items.length };
  },
};

backgroundJobRegister(runnerSubmitJobDefinition);
backgroundJobRegister(runnerPollJobDefinition);
backgroundJobRegister(runnerReconcileJobDefinition);

export { enqueueRunnerSubmit };
