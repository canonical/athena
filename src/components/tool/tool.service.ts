import {
  executeAthenaEmitBlocker,
  executeAthenaMarkComplete,
  executeAthenaRequestChat,
} from "./tool.athena.service.js";
import { executeRepoFind, executeRepoLs, executeRepoRead, executeRepoSearch, executeRepoSymbolIndex, executeTaskRepositories } from "./tool.github.service.js";
import { executeJiraAddComment, executeJiraAddLabels, executeJiraCreateIssue, executeJiraEditField, executeJiraFieldList, executeJiraReadIssue, executeJiraRemoveLabels, executeJiraSearch, executeJiraTransitionIssue, executeJiraTransitionList } from "./tool.jira.service.js";
import type { ProviderToolBatchResult, ProviderToolExecutionContext, ProviderToolRequest, ProviderToolResult } from "./tool.schema.js";

const executeSingleTool = async (context: ProviderToolExecutionContext, request: ProviderToolRequest): Promise<ProviderToolResult> => {
  const input = request.input;

  try {
    switch (request.tool) {
      case "task_repositories":
        return { tool: request.tool, ok: true, result: await executeTaskRepositories(context) };
      case "repo_ls":
        return { tool: request.tool, ok: true, result: await executeRepoLs(context, input) };
      case "repo_read":
        return { tool: request.tool, ok: true, result: await executeRepoRead(context, input) };
      case "repo_search":
        return { tool: request.tool, ok: true, result: await executeRepoSearch(context, input) };
      case "jira_field_list":
        return { tool: request.tool, ok: true, result: await executeJiraFieldList(context) };
      case "jira_edit_field":
        return { tool: request.tool, ok: true, result: await executeJiraEditField(context, input) };
      case "repo_find":
        return { tool: request.tool, ok: true, result: await executeRepoFind(context, input) };
      case "repo_symbol_index":
        return { tool: request.tool, ok: true, result: await executeRepoSymbolIndex(context, input) };
      case "jira_read_issue":
        return { tool: request.tool, ok: true, result: await executeJiraReadIssue(context, input) };
      case "jira_search":
        return { tool: request.tool, ok: true, result: await executeJiraSearch(context, input) };
      case "jira_create_issue":
        return { tool: request.tool, ok: true, result: await executeJiraCreateIssue(context, input) };
      case "jira_add_labels":
        return { tool: request.tool, ok: true, result: await executeJiraAddLabels(context, input) };
      case "jira_remove_labels":
        return { tool: request.tool, ok: true, result: await executeJiraRemoveLabels(context, input) };
      case "jira_transition_list":
        return { tool: request.tool, ok: true, result: await executeJiraTransitionList(context, input) };
      case "jira_transition_issue":
        return { tool: request.tool, ok: true, result: await executeJiraTransitionIssue(context, input) };
      case "jira_add_comment":
        return { tool: request.tool, ok: true, result: await executeJiraAddComment(context, input) };
      case "athena_emit_blocker":
        return { tool: request.tool, ok: true, result: await executeAthenaEmitBlocker(context, input) };
      case "athena_mark_complete":
        return { tool: request.tool, ok: true, result: await executeAthenaMarkComplete(context, input) };
      case "athena_request_chat":
        return { tool: request.tool, ok: true, result: await executeAthenaRequestChat(context, input) };
      default:
        return { tool: request.tool, ok: false, error: `Tool ${request.tool} is not implemented.` };
    }
  } catch (error) {
    return {
      tool: request.tool,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const executeProviderToolBatch = async (context: ProviderToolExecutionContext, requests: ProviderToolRequest[]): Promise<ProviderToolBatchResult> => {
  const results: ProviderToolResult[] = [];

  for (const request of requests) {
    results.push(await executeSingleTool(context, request));
  }

  return {
    results,
    hadError: results.some((entry) => !entry.ok),
  };
};
