import { resolveLoopSelection } from "@components/loop/loop-selection.service.js";
import { queryRunnerQueueCreate } from "@components/runner/runner.queue.service.js";
import type { ProviderToolExecutionContext } from "./tool.schema.js";

export const executeAthenaEnqueueRun = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const { taskId, loopId } = context;
  const prompt = typeof input?.prompt === `string` ? input.prompt.trim() : ``;
  const plan = typeof input?.plan === `string` ? input.plan.trim() : ``;
  const repository = typeof input?.repository === `string` ? input.repository.trim() : ``;

  console.log(`[athena_enqueue_run] invoked`, { taskId, loopId, repository });

  const runnerResolution = await resolveLoopSelection(loopId, `runner`);

  if (!runnerResolution.selected) {
    console.log(`[athena_enqueue_run] no runner available`, { taskId, loopId, audit: runnerResolution.audit });
    return { queued: false, reason: `no-runner-available` };
  }

  const { assignmentId, definitionType } = runnerResolution.selected;
  console.log(`[athena_enqueue_run] runner selected`, { taskId, loopId, assignmentId, definitionType });

  const queueItem = await queryRunnerQueueCreate(loopId, taskId, assignmentId, repository, prompt, plan);
  console.log(`[athena_enqueue_run] enqueued`, { taskId, loopId, queueItemId: queueItem.id, runnerType: definitionType, repository });

  return { queued: true, queueItemId: queueItem.id, runnerType: definitionType, repository };
};
