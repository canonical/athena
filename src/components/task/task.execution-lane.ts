import type { TaskKind } from "./task.schema.js";

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

const toolSet = new Set<string>([
  `task_repositories`,
  `repo_ls`,
  `repo_read`,
  `repo_search`,
  `repo_find`,
  `repo_symbol_index`,
  `jira_read_issue`,
  `jira_search`,
  `jira_add_labels`,
  `jira_remove_labels`,
  `jira_transition_issue`,
  `jira_add_comment`,
  `athena_task_claim`,
  `athena_task_update_state`,
  `athena_task_append_timeline`,
  `athena_task_link_workgraph_item`,
  `athena_emit_blocker`,
  `athena_mark_complete`,
]);

export const isProviderBasedToolAllowed = (toolName: string): boolean => {
  return toolSet.has(toolName);
};
