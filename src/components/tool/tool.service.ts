import * as athenaExecutors from "./tool.athena.service.js";
import { providerToolInputSchemas } from "./tool.catalog.js";
import * as githubExecutors from "./tool.github.service.js";
import * as runnerExecutors from "./tool.runner.service.js";
import type { ProviderToolBatchResult, ProviderToolExecutionContext, ProviderToolRequest, ProviderToolResult } from "./tool.schema.js";
import * as workgraphExecutors from "./tool.workgraph.service.js";

type ProviderToolExecutor = (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined) => Promise<unknown>;

const validateToolInput = (request: ProviderToolRequest): string[] => {
  const schema = providerToolInputSchemas[request.tool];

  if (!schema) {
    return [];
  }

  const result = schema.safeParse(request.input ?? {});

  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue: (typeof result.error.issues)[number]) => {
    const path = issue.path.length > 0 ? `input.${issue.path.join(`.`)}` : `input`;
    return `${path} ${issue.message}`;
  });
};

const providerToolExecutors: Record<string, ProviderToolExecutor> = {
  task_repositories: async (context) => githubExecutors.executeTaskRepositories(context),
  task_workgraphs: async (context) => workgraphExecutors.executeTaskWorkgraphs(context),
  repo_ls: async (context, input) => githubExecutors.executeRepoLs(context, input),
  repo_read: async (context, input) => githubExecutors.executeRepoRead(context, input),
  repo_search: async (context, input) => githubExecutors.executeRepoSearch(context, input),
  repo_find: async (context, input) => githubExecutors.executeRepoFind(context, input),
  repo_symbol_index: async (context, input) => githubExecutors.executeRepoSymbolIndex(context, input),
  workgraph_refresh: async (context, input) => workgraphExecutors.executeWorkgraphRefresh(context, input),
  workgraph_read_item: async (context, input) => workgraphExecutors.executeWorkgraphReadItem(context, input),
  workgraph_assign_task_item: async (context, input) => workgraphExecutors.executeWorkgraphAssignTaskItem(context, input),
  workgraph_search_items: async (context, input) => workgraphExecutors.executeWorkgraphSearchItems(context, input),
  workgraph_create_item: async (context, input) => workgraphExecutors.executeWorkgraphCreateItem(context, input),
  workgraph_add_labels: async (context, input) => workgraphExecutors.executeWorkgraphAddLabels(context, input),
  workgraph_remove_labels: async (context, input) => workgraphExecutors.executeWorkgraphRemoveLabels(context, input),
  workgraph_list_transitions: async (context, input) => workgraphExecutors.executeWorkgraphListTransitions(context, input),
  workgraph_transition_item: async (context, input) => workgraphExecutors.executeWorkgraphTransitionItem(context, input),
  workgraph_list_fields: async (context, input) => workgraphExecutors.executeWorkgraphFieldList(context, input),
  workgraph_edit_field: async (context, input) => workgraphExecutors.executeWorkgraphEditField(context, input),
  workgraph_add_comment: async (context, input) => workgraphExecutors.executeWorkgraphAddComment(context, input),
  athena_mark_complete: async (context, input) => athenaExecutors.executeAthenaMarkComplete(context, input),
  athena_compact_queue: async (context, input) => athenaExecutors.executeAthenaCompactQueue(context, input),
  athena_define_objective: async (context, input) => athenaExecutors.executeAthenaDefineObjective(context, input),
  athena_define_title: async (context, input) => athenaExecutors.executeAthenaDefineTitle(context, input),
  athena_get_objective: async (context) => athenaExecutors.executeAthenaGetObjective(context),
  athena_get_title: async (context) => athenaExecutors.executeAthenaGetTitle(context),
  athena_list_models: async (context) => athenaExecutors.executeAthenaListModels(context),
  athena_list_personas: async (context) => athenaExecutors.executeAthenaListPersonas(context),
  athena_ask_other_persona: async (context, input) => athenaExecutors.executeAthenaAskOtherPersona(context, input),
  athena_assign_to_workgraph_item: async (context, input) => athenaExecutors.executeAthenaAssignToWorkgraphItem(context, input),
  athena_enqueue_run: async (context, input) => runnerExecutors.executeAthenaEnqueueRun(context, input),
};

const executeSingleTool = async (context: ProviderToolExecutionContext, request: ProviderToolRequest): Promise<ProviderToolResult> => {
  const input = request.input;
  const executor = providerToolExecutors[request.tool];

  try {
    if (!executor) {
      return { tool: request.tool, ok: false, error: `Tool ${request.tool} is not implemented.` };
    }

    const validationErrors = validateToolInput(request);

    if (validationErrors.length > 0) {
      return {
        tool: request.tool,
        ok: false,
        error: `Invalid input for ${request.tool}: ${validationErrors.join(" ")}`,
      };
    }

    return { tool: request.tool, ok: true, result: await executor(context, input) };
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
