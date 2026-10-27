import { backgroundJobRegister } from "@components/background-job/background-job.registry.js";
import type { BackgroundJobDefinition } from "@components/background-job/background-job.schema.js";
import { backgroundJobEnqueue } from "@components/background-job/background-job.service.js";
import { log } from "@components/logging/logging.service.js";
import { getPool, type QueryExecutor } from "@components/postgres/postgres.js";
import { triggerTaskProcessor } from "@components/task/task.processor.js";
import { delay } from "@components/utilities/timers.js";
import { z } from "zod";
import { pollCopilotAgentTask, submitCopilotAgentTask } from "./runner.copilot.adapter.js";
import { CopilotAgentTaskIdMissingError } from "./runner.errors.js";
import { queryRunnerQueueById, queryRunnerQueueCreate, queryRunnerQueueFinalize, queryRunnerQueueListActiveByRunnerType, queryRunnerQueueMarkSubmitting, queryRunnerQueueStoreExternalTaskId } from "./runner.queue.service.js";
import type { RunnerQueueItem } from "./runner.schema.js";
import { queryRunnerDecryptCredential } from "./runner.service.js";

const runnerQueueJobPayloadSchema = z.object({ runnerQueueId: z.uuid() });
type RunnerQueueJobPayload = z.infer<typeof runnerQueueJobPayloadSchema>;
const runnerPollDelaySeconds = 15;
const athenaRunnerType = `github-copilot-cloud`;

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

export const enqueueRunnerSubmit = async (runnerQueueId: string, executor?: QueryExecutor) => backgroundJobEnqueue(runnerSubmitJobDefinition, { runnerQueueId }, { singletonKey: runnerQueueId }, executor);

const enqueueRunnerPoll = async (runnerQueueId: string) => backgroundJobEnqueue(runnerPollJobDefinition, { runnerQueueId }, { singletonKey: runnerQueueId, startAfter: runnerPollDelaySeconds });

export const queryRunnerQueueCreateAndEnqueue = async (loopId: string, taskId: string, runnerId: string, repository: string, prompt: string, plan: string): Promise<RunnerQueueItem> => {
  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);
    const item = await queryRunnerQueueCreate(loopId, taskId, runnerId, repository, prompt, plan, client);
    await enqueueRunnerSubmit(item.id, client);
    await client.query(`COMMIT`);
    return item;
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

export const enqueueRunnerRecoveryJobs = async (): Promise<number> => {
  const items = await queryRunnerQueueListActiveByRunnerType(athenaRunnerType);

  for (const item of items) {
    if (item.status === `claimed` && item.externalTaskId) {
      await enqueueRunnerPoll(item.id);
    } else {
      await enqueueRunnerSubmit(item.id);
    }
  }

  log.info(`Runner background job recovery completed`, { activeItemCount: items.length });
  return items.length;
};

const finalizeRunner = async (runnerQueueId: string, status: `completed` | `failed`, result: string): Promise<boolean> => {
  const taskMessage = status === `completed` ? `Runner task completed. Result:\n${result}` : `Runner task failed. Details:\n${result}`;
  const finalized = await queryRunnerQueueFinalize(runnerQueueId, status, result, taskMessage);

  if (finalized) {
    triggerTaskProcessor();
  }

  return finalized;
};

const runnerSubmitJobDefinition: BackgroundJobDefinition<RunnerQueueJobPayload, { skipped: boolean }> = {
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

const runnerPollJobDefinition: BackgroundJobDefinition<RunnerQueueJobPayload, { done: boolean; skipped: boolean }> = {
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

backgroundJobRegister(runnerSubmitJobDefinition);
backgroundJobRegister(runnerPollJobDefinition);
