import { taskKindDefinitions, type TaskExecutionLane, type TaskKind } from "./task.schema.js";
import { providerToolNames } from "@components/tool/tool.catalog.js";

export const executionLanes = [`provider-based`, `runner-based`] as const;
export type ExecutionLane = TaskExecutionLane;

export const executionLaneForTargetType = (targetType: `provider` | `runner`): ExecutionLane => {
  return targetType === `runner` ? `runner-based` : `provider-based`;
};

const taskKindRequirementByKind = new Map<TaskKind, ExecutionLane>(taskKindDefinitions.map((definition) => [definition.kind, definition.requiredExecutionLane]));

export const taskKindRequirementCatalog = taskKindDefinitions;

export const resolveRequiredExecutionLaneForTaskKind = (taskKind: TaskKind): ExecutionLane => {
  const requiredLane = taskKindRequirementByKind.get(taskKind);

  if (!requiredLane) {
    throw new Error(`Unknown task kind: ${taskKind}`);
  }

  return requiredLane;
};

export const requiresRunnerLaneByTaskKind = (taskKind: TaskKind): boolean => {
  return resolveRequiredExecutionLaneForTaskKind(taskKind) === `runner-based`;
};

const toolSet = new Set<string>(providerToolNames);

const isReadonlyStringSet = (value: ReadonlyArray<string> | ReadonlySet<string>): value is ReadonlySet<string> => {
  return typeof (value as { has?: unknown }).has === `function`;
};

export const isProviderBasedToolAllowed = (toolName: string, enabledToolNames?: ReadonlyArray<string> | ReadonlySet<string>): boolean => {
  if (!toolSet.has(toolName)) {
    return false;
  }

  if (!enabledToolNames) {
    return true;
  }

  return isReadonlyStringSet(enabledToolNames) ? enabledToolNames.has(toolName) : enabledToolNames.includes(toolName);
};
