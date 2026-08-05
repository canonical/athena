export type ProviderToolDefinition = {
  name: string;
  description: string;
};

export const providerToolDefinitions: ReadonlyArray<ProviderToolDefinition> = [
  { name: `task_repositories`, description: `List repositories available for the current task.` },
  { name: `repo_ls`, description: `List files and directories in a repository available for this task.` },
  { name: `repo_read`, description: `Read a file from a repository available for this task.` },
  { name: `repo_search`, description: `Search code in a repository available for this task using GitHub code search.` },
  { name: `repo_find`, description: `Find files in a repository available for this task by regex pattern.` },
  { name: `repo_symbol_index`, description: `Find symbol occurrences in repository files with identifier-aware matching and line-level hits.` },
  { name: `jira_read_issue`, description: `Read details for a Jira issue by issueKey or issueId.` },
  { name: `jira_search`, description: `Search Jira issues using JQL.` },
  { name: `jira_create_issue`, description: `Create a Jira issue using default and optional custom fields.` },
  { name: `jira_add_labels`, description: `Add labels to a Jira issue.` },
  { name: `jira_remove_labels`, description: `Remove labels from a Jira issue.` },
  { name: `jira_transition_list`, description: `List available Jira transitions for an issue.` },
  { name: `jira_transition_issue`, description: `Transition a Jira issue to another state.` },
  { name: `jira_field_list`, description: `List available Jira fields with ids and schema hints.` },
  { name: `jira_edit_field`, description: `Edit a Jira issue field by fieldId.` },
  { name: `jira_add_comment`, description: `Add a comment to a Jira issue.` },
  { name: `athena_emit_blocker`, description: `Emit a blocker intent for the current task.` },
  { name: `athena_mark_complete`, description: `Emit a completion intent for the current task.` },
  { name: `athena_request_chat`, description: `Emit a request-chat intent for the current task.` },
];

export const providerToolNames: ReadonlyArray<string> = providerToolDefinitions.map((tool) => tool.name);

const providerToolNameSet = new Set(providerToolNames);

export const isKnownProviderToolName = (toolName: string): boolean => providerToolNameSet.has(toolName);

export const normalizeProviderToolNames = (toolNames: ReadonlyArray<string>): string[] => {
  const uniqueRequested = new Set(toolNames);
  return providerToolNames.filter((toolName) => uniqueRequested.has(toolName));
};

export const enabledProviderToolNamesFromDisabled = (disabledToolNames: ReadonlyArray<string>): string[] => {
  const normalizedDisabled = new Set(normalizeProviderToolNames(disabledToolNames));
  return providerToolNames.filter((toolName) => !normalizedDisabled.has(toolName));
};

export const disabledProviderToolNamesFromEnabled = (enabledToolNames: ReadonlyArray<string>): string[] => {
  const normalizedEnabled = new Set(normalizeProviderToolNames(enabledToolNames));
  return providerToolNames.filter((toolName) => !normalizedEnabled.has(toolName));
};
