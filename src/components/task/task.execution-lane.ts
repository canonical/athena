import type { TaskKind } from "./task.schema.js";
import { providerToolNames } from "@components/tool/tool.catalog.js";

export const executionLanes = [`provider-based`, `runner-based`] as const;
export type ExecutionLane = (typeof executionLanes)[number];

export const executionLaneForTargetType = (targetType: `provider` | `runner`): ExecutionLane => {
  return targetType === `runner` ? `runner-based` : `provider-based`;
};

export const requiredExecutionLaneByTaskKind: Record<TaskKind, ExecutionLane> = {
  coding: `runner-based`,
  "jira-refinement": `provider-based`,
  analysis: `provider-based`,
  design: `provider-based`,
  research: `provider-based`,
  other: `provider-based`,
};

export const resolveRequiredExecutionLaneForTaskKind = (taskKind: TaskKind): ExecutionLane => {
  return requiredExecutionLaneByTaskKind[taskKind];
};

export const requiresRunnerLaneByTaskKind = (taskKind: TaskKind): boolean => {
  return resolveRequiredExecutionLaneForTaskKind(taskKind) === `runner-based`;
};

const toolSet = new Set<string>(providerToolNames);

export const isProviderBasedToolAllowed = (toolName: string, enabledToolNames?: ReadonlyArray<string> | ReadonlySet<string>): boolean => {
  if (!toolSet.has(toolName)) {
    return false;
  }

  if (!enabledToolNames) {
    return true;
  }

  return enabledToolNames instanceof Set ? enabledToolNames.has(toolName) : enabledToolNames.includes(toolName);
};
