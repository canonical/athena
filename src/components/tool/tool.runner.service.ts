import { resolveLoopSelection, resolveLoopSelectionByAssignment } from "@components/loop/loop-selection.service.js";
import { queryLoopRepositoryApiConnectionList } from "@components/repository/repository.service.js";
import { queryRunnerQueueCreate } from "@components/runner/runner.queue.service.js";
import { queryLoopRunnersForRepository } from "@components/runner/runner.service.js";
import { isValidUuid } from "@components/utilities/zod.utilities.js";
import type { ProviderToolExecutionContext } from "./tool.schema.js";

type RepositoryConnection = Awaited<ReturnType<typeof queryLoopRepositoryApiConnectionList>>[number];

const normalizeRepositorySelector = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const resolveRepositoryConnection = async (loopId: string, selector: unknown): Promise<RepositoryConnection> => {
  const connections = await queryLoopRepositoryApiConnectionList(loopId);

  if (connections.length === 0) {
    throw new Error("No enabled repository assignment is available for this loop.");
  }

  const resolvedSelector = normalizeRepositorySelector(selector);
  if (!resolvedSelector) {
    return connections[0] as RepositoryConnection;
  }

  const needle = resolvedSelector.toLowerCase();
  const matched = connections.find((connection) => {
    const ownerRepo = `${connection.repositoryOwner}/${connection.repositoryName}`.toLowerCase();
    return connection.repositoryId.toLowerCase() === needle || connection.displayName.toLowerCase() === needle || ownerRepo === needle;
  });

  if (matched) {
    return matched;
  }

  const available = connections.map((connection) => `${connection.displayName} (${connection.repositoryOwner}/${connection.repositoryName})`).join(", ");
  throw new Error(`Unknown repository selector '${resolvedSelector}'. Available repositories: ${available}`);
};

export const executeTaskRunners = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const connection = await resolveRepositoryConnection(context.loopId, input?.repository);
  const runners = await queryLoopRunnersForRepository(context.loopId, connection.repositoryId);

  return {
    repositoryId: connection.repositoryId,
    repository: `${connection.repositoryOwner}/${connection.repositoryName}`,
    total: runners.length,
    runners: runners.map((runner) => ({
      runnerId: runner.runner,
      displayName: runner.displayName,
      runnerType: runner.runnerType,
      enabled: runner.enabled,
      priority: runner.priority,
      priorityOverride: runner.priorityOverride,
      healthStatus: runner.healthStatus,
      cooldownUntil: runner.cooldownUntil,
      lastUsedAt: runner.lastUsedAt,
    })),
  };
};

export const executeAthenaEnqueueRun = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const { taskId, loopId } = context;
  const prompt = typeof input?.prompt === `string` ? input.prompt.trim() : ``;
  const plan = typeof input?.plan === `string` ? input.plan.trim() : ``;
  const runner = typeof input?.runner === `string` ? input.runner.trim() : ``;

  const repositoryConnection = await resolveRepositoryConnection(loopId, input?.repository);
  const repository = `${repositoryConnection.repositoryOwner}/${repositoryConnection.repositoryName}`;

  console.log(`[athena_enqueue_run] invoked`, { taskId, loopId, repository, repositoryId: repositoryConnection.repositoryId, runner });

  const runnerResolution = await (runner.length > 0
    ? (() => {
        if (!isValidUuid(runner)) {
          throw new Error(`runner must be a valid UUID when provided.`);
        }

        return resolveLoopSelectionByAssignment(loopId, `runner`, runner, { repositoryId: repositoryConnection.repositoryId });
      })()
    : resolveLoopSelection(loopId, `runner`, { repositoryId: repositoryConnection.repositoryId }));

  if (!runnerResolution.selected) {
    console.log(`[athena_enqueue_run] no runner available`, { taskId, loopId, repositoryId: repositoryConnection.repositoryId, audit: runnerResolution.audit });
    return { queued: false, reason: `no-compatible-runner-available`, repository };
  }

  const { assignmentId, definitionType } = runnerResolution.selected;
  console.log(`[athena_enqueue_run] runner selected`, { taskId, loopId, assignmentId, definitionType, repositoryId: repositoryConnection.repositoryId });

  const queueItem = await queryRunnerQueueCreate(loopId, taskId, assignmentId, repository, prompt, plan);
  console.log(`[athena_enqueue_run] enqueued`, { taskId, loopId, queueItemId: queueItem.id, runnerType: definitionType, repository, repositoryId: repositoryConnection.repositoryId });

  return { queued: true, queueItemId: queueItem.id, runnerId: assignmentId, runnerType: definitionType, repository };
};
