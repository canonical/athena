import { log } from "@components/logging/logging.service.js";
import type { OpenRouterMessage, OpenRouterTool } from "@components/openrouter/openrouter.schema.js";
import { fetchOpenRouterChatCompletion, OpenRouterRequestError, readOpenRouterContentText, readOpenRouterUsageCostUsd } from "@components/openrouter/openrouter.service.js";
import type { Persona } from "@components/persona/persona.schema.js";
import { executeProviderToolBatch } from "@components/tool/tool.service.js";
import type { ProviderToolRequest } from "@components/tool/tool.schema.js";
import { readWorkDoneLabelFromAssignmentConfig, readWorkInProgressLabelFromAssignmentConfig, readWorkOnLabelFromAssignmentConfig } from "@components/workgraph/workgraph.assignment-config.js";
import { queryLoopWorkgraphList } from "@components/workgraph/workgraph.pg.service.js";
import { v7 as uuidv7 } from "uuid";
import { buildTaskConversationMessages, buildTaskOpenRouterSessionId } from "./task.history.js";
import { isProviderBasedToolAllowed } from "./task.execution-lane.js";
import type { Task, TimelineEntry } from "./task.schema.js";

type ProviderExecutionTarget = {
  targetType: `provider`;
  targetId: string;
  definitionType: string;
  secret: string;
  model: string;
  baseUrl?: string | null;
};

type RunnerExecutionTarget = {
  targetType: `runner`;
  targetId: string;
  definitionType: string;
  secret: string;
  model?: string;
  baseUrl?: string | null;
};

type ExecutionTarget = ProviderExecutionTarget | RunnerExecutionTarget;

export type TaskExecutionResult = {
  status: `completed` | `requires-user-input` | `blocked`;
  summary: string;
  output: string;
  blocker?: string;
  achieved?: boolean;
  nextContext?: string;
  llmTimelineEntries?: TimelineEntry[];
  llmCostUsd: number;
  llmCallCount: number;
};

type ProviderAutonomyResponse = {
  achieved: boolean;
  summary: string;
  output: string;
  nextContext?: string;
};

type OpenRouterToolCall = {
  id: string;
  type: `function`;
  function: {
    name: string;
    arguments: string;
  };
};

type ProviderExecutionOptions = {
  iteration: number;
  iterationCostLimitUsd: number | null;
};

const parseProviderAutonomyResponse = (rawMessage: string): ProviderAutonomyResponse | null => {
  const normalized = rawMessage.trim();

  if (!normalized.startsWith(`{`) || !normalized.endsWith(`}`)) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as Record<string, unknown>;

    if (typeof parsed.achieved !== `boolean`) {
      return null;
    }

    if (typeof parsed.summary !== `string` || parsed.summary.trim().length === 0) {
      return null;
    }

    if (typeof parsed.output !== `string` || parsed.output.trim().length === 0) {
      return null;
    }

    const nextContext = typeof parsed.nextContext === `string` && parsed.nextContext.trim().length > 0 ? parsed.nextContext.trim() : undefined;
    return {
      achieved: parsed.achieved,
      summary: parsed.summary.trim(),
      output: parsed.output.trim(),
      nextContext,
    };
  } catch {
    return null;
  }
};

const providerTools: OpenRouterTool[] = [
  {
    type: `function`,
    function: {
      name: `task_repositories`,
      description: `List repositories available for the current task.`,
      parameters: { type: `object`, properties: {}, additionalProperties: false },
    },
  },
  {
    type: `function`,
    function: {
      name: `repo_ls`,
      description: `List files and directories in a repository available for this task.`,
      parameters: {
        type: `object`,
        properties: {
          repository: { type: `string`, description: `Optional selector: repositoryId, displayName, or owner/name.` },
          path: { type: `string`, description: `Optional repository-relative path. Defaults to repository root.` },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `repo_read`,
      description: `Read a file from a repository available for this task.`,
      parameters: {
        type: `object`,
        properties: {
          repository: { type: `string`, description: `Optional selector: repositoryId, displayName, or owner/name.` },
          path: { type: `string`, description: `Repository-relative file path.` },
          startLine: { type: `integer`, minimum: 1 },
          endLine: { type: `integer`, minimum: 1 },
          maxLines: { type: `integer`, minimum: 1, maximum: 2000 },
        },
        required: [`path`],
        additionalProperties: false,
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `repo_search`,
      description: `Search code in a repository available for this task using GitHub code search.`,
      parameters: {
        type: `object`,
        properties: {
          repository: { type: `string`, description: `Optional selector: repositoryId, displayName, or owner/name.` },
          query: { type: `string`, description: `Search query.` },
          path: { type: `string`, description: `Optional repository-relative path prefix to scope search results.` },
          caseSensitive: { type: `boolean`, description: `Whether search should be case-sensitive. Defaults to false.` },
          maxMatches: { type: `integer`, minimum: 1, maximum: 500 },
        },
        required: [`query`],
        additionalProperties: false,
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `repo_find`,
      description: `Find files in a repository available for this task by regex pattern.`,
      parameters: {
        type: `object`,
        properties: {
          repository: { type: `string`, description: `Optional selector: repositoryId, displayName, or owner/name.` },
          path: { type: `string`, description: `Optional repository-relative path prefix to scope the search.` },
          pattern: { type: `string`, description: `JavaScript regex source pattern used to match file paths.` },
          flags: { type: `string`, description: `Optional JavaScript regex flags (for example: i, m, u).` },
          maxMatches: { type: `integer`, minimum: 1, maximum: 1000 },
        },
        required: [`pattern`],
        additionalProperties: false,
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `repo_symbol_index`,
      description: `Find symbol occurrences in repository files with identifier-aware matching and line-level hits.`,
      parameters: {
        type: `object`,
        properties: {
          repository: { type: `string`, description: `Optional selector: repositoryId, displayName, or owner/name.` },
          symbol: { type: `string`, description: `Symbol identifier to look up.` },
          path: { type: `string`, description: `Optional repository-relative path prefix to scope symbol indexing.` },
          caseSensitive: { type: `boolean`, description: `Whether symbol matching should be case-sensitive. Defaults to true.` },
          maxMatches: { type: `integer`, minimum: 1, maximum: 200 },
        },
        required: [`symbol`],
        additionalProperties: false,
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `jira_read_issue`,
      description: `Read details for a Jira issue by issueKey or issueId.`,
      parameters: {
        type: `object`,
        properties: {
          issueKey: { type: `string` },
          issueId: { type: `string` },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `jira_search`,
      description: `Search Jira issues using JQL.`,
      parameters: {
        type: `object`,
        properties: {
          jql: { type: `string` },
          maxResults: { type: `integer`, minimum: 1, maximum: 100 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `jira_add_labels`,
      description: `Add labels to a Jira issue. Labels must be from the loop workgraph label configuration.`,
      parameters: {
        type: `object`,
        properties: {
          issueKey: { type: `string` },
          issueId: { type: `string` },
          labels: { type: `array`, items: { type: `string` }, minItems: 1 },
        },
        required: [`labels`],
        additionalProperties: false,
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `jira_remove_labels`,
      description: `Remove labels from a Jira issue. Labels must be from the loop workgraph label configuration.`,
      parameters: {
        type: `object`,
        properties: {
          issueKey: { type: `string` },
          issueId: { type: `string` },
          labels: { type: `array`, items: { type: `string` }, minItems: 1 },
        },
        required: [`labels`],
        additionalProperties: false,
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `jira_transition_issue`,
      description: `Transition a Jira issue to another state.`,
      parameters: {
        type: `object`,
        properties: {
          issueKey: { type: `string` },
          issueId: { type: `string` },
          transitionId: { type: `string` },
        },
        required: [`transitionId`],
        additionalProperties: false,
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `jira_add_comment`,
      description: `Add a comment to a Jira issue.`,
      parameters: {
        type: `object`,
        properties: {
          issueKey: { type: `string` },
          issueId: { type: `string` },
          comment: { type: `string` },
        },
        required: [`comment`],
        additionalProperties: false,
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `athena_task_claim`,
      description: `Read claim-related task state.`,
      parameters: { type: `object`, properties: {}, additionalProperties: false },
    },
  },
  {
    type: `function`,
    function: {
      name: `athena_task_update_state`,
      description: `Update task execution context and blocker fields.`,
      parameters: {
        type: `object`,
        properties: {
          context: { type: `string` },
          blocker: { type: [`string`, `null`] },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `athena_task_append_timeline`,
      description: `Append a timeline entry to the task payload.`,
      parameters: {
        type: `object`,
        properties: {
          type: { type: `string` },
          actor: { type: `string` },
          data: { type: `object`, additionalProperties: true },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `athena_task_link_workgraph_item`,
      description: `Link a task to a workgraph item (placeholder in current phase).`,
      parameters: { type: `object`, properties: {}, additionalProperties: true },
    },
  },
  {
    type: `function`,
    function: {
      name: `athena_emit_blocker`,
      description: `Mark the task as blocked with a blocker reason.`,
      parameters: {
        type: `object`,
        properties: {
          blocker: { type: `string` },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `athena_mark_complete`,
      description: `Mark the task as completed.`,
      parameters: {
        type: `object`,
        properties: {
          note: { type: `string` },
        },
        additionalProperties: false,
      },
    },
  },
];

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === `object` && !Array.isArray(value);

const parseToolCallArguments = (raw: string): Record<string, unknown> | undefined => {
  const normalized = raw.trim();

  if (normalized.length === 0) {
    return undefined;
  }

  const parsed = JSON.parse(normalized) as unknown;

  if (!isRecord(parsed)) {
    throw new Error(`Tool call arguments must be a JSON object.`);
  }

  return parsed;
};

const toProviderToolRequests = (toolCalls: OpenRouterToolCall[]): ProviderToolRequest[] =>
  toolCalls.map((toolCall) => ({
    tool: toolCall.function.name,
    input: parseToolCallArguments(toolCall.function.arguments),
  }));

const buildStablePersonaSystemPrompt = (task: Task, selectedPersona: Persona): string =>
  [`You are ${selectedPersona.displayName}.`, selectedPersona.role ? `Role: ${selectedPersona.role}.` : null, `Personality guidance: ${selectedPersona.personality}`, `Current objective: ${task.description}`].filter(Boolean).join(`\n`);

const buildStableAutonomyContractPrompt = (jiraLabelGuidance?: string): string => {
  const sections = [
    `Return only strict JSON with keys: achieved (boolean), summary (string), output (string), nextContext (string, optional).`,
    `Do not include markdown, code fences, or any keys other than achieved, summary, output, nextContext.`,
    `When external data or side effects are needed, call tools via native tool calling (never by embedding tool requests in message content).`,
    `Provider-based execution must use Athena-defined tools only and must not mutate repositories.`,
    `For repository work, call task_repositories first when needed; repo_ls/repo_read/repo_search/repo_find/repo_symbol_index accept optional repository selector (repositoryId, displayName, or owner/name). repo_search and repo_symbol_index also support optional caseSensitive and path scoping. Choose only from repositories available for this task.`,
    jiraLabelGuidance,
    `After tool results are returned, continue and eventually produce the strict JSON response.`,
    `Set achieved=true only when objective is fully achieved.`,
  ].filter((entry): entry is string => typeof entry === `string` && entry.trim().length > 0);

  return sections.join(`\n`);
};

const readJiraLabelGuidanceForLoop = async (loopId: string): Promise<string | undefined> => {
  const assignments = await queryLoopWorkgraphList(loopId);
  const jiraAssignment = assignments.find((assignment) => assignment.enabled && assignment.type === `jira`);

  if (!jiraAssignment) {
    return undefined;
  }

  const workOnLabel = readWorkOnLabelFromAssignmentConfig(jiraAssignment.assignmentConfig);
  const workInProgressLabel = readWorkInProgressLabelFromAssignmentConfig(jiraAssignment.assignmentConfig);
  const workDoneLabel = readWorkDoneLabelFromAssignmentConfig(jiraAssignment.assignmentConfig);

  return [
    `Jira label definitions for this loop:`,
    `- ${workOnLabel}: indicates issues ready to start.`,
    `- ${workInProgressLabel}: indicates work currently in progress.`,
    `- ${workDoneLabel}: indicates work completed.`,
    `When using jira_add_labels or jira_remove_labels, only use these loop-configured labels and keep transitions consistent with their meanings.`,
  ].join(`\n`);
};

const buildStableRequestedOutcomePrompt = (task: Task): string => `Requested outcome: ${task.description ?? task.description}`;

const buildVolatileIterationPrompt = (task: Task, options: ProviderExecutionOptions): string => [`Iteration ${options.iteration}.`, `Current context: ${task.context}`].join(`\n`);

const buildProviderMessages = (task: Task, selectedPersona: Persona, options: ProviderExecutionOptions, jiraLabelGuidance?: string): OpenRouterMessage[] => [
  {
    role: `system`,
    content: buildStablePersonaSystemPrompt(task, selectedPersona),
  },
  {
    role: `system`,
    content: buildStableAutonomyContractPrompt(jiraLabelGuidance),
  },
  {
    role: `user`,
    content: buildStableRequestedOutcomePrompt(task),
  },
  ...buildTaskConversationMessages(task),
  {
    role: `user`,
    content: buildVolatileIterationPrompt(task, options),
  },
];

const makeLlmCallTimelineEntry = (actor: string, data: Record<string, unknown>): TimelineEntry => ({
  id: uuidv7(),
  timestamp: new Date().toISOString(),
  type: `llm-call`,
  actor,
  data,
});

const executeProviderRequest = async (task: Task, selectedPersona: Persona, target: ProviderExecutionTarget, options: ProviderExecutionOptions): Promise<TaskExecutionResult> => {
  if (target.definitionType !== `openrouter`) {
    return {
      status: `blocked`,
      summary: `Unsupported provider type for execution in current phase.`,
      output: `Provider ${target.definitionType} is not executable in this phase.`,
      blocker: `Unsupported provider type: ${target.definitionType}`,
      llmTimelineEntries: [],
      llmCostUsd: 0,
      llmCallCount: 0,
    };
  }

  const llmTimelineEntries: TimelineEntry[] = [];
  let llmCostUsd = 0;
  let llmCallCount = 0;
  let toolRound = 0;
  const jiraLabelGuidance = await readJiraLabelGuidanceForLoop(task.loop).catch((error) => {
    log.warn(`Unable to read Jira label guidance for provider execution`, {
      loopId: task.loop,
      taskId: task.id,
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
    });
    return undefined;
  });
  let messages = buildProviderMessages(task, selectedPersona, options, jiraLabelGuidance);

  try {
    while (true) {
      const payload = await fetchOpenRouterChatCompletion(
        {
          baseUrl: target.baseUrl ?? `https://openrouter.ai/api/v1`,
          apiKey: target.secret,
        },
        {
          model: target.model,
          temperature: 0.2,
          idempotencyKey: task.claimToken ?? task.id,
          sessionId: buildTaskOpenRouterSessionId(task.id, `execution`),
          operation: `task-provider-execution`,
          context: {
            taskId: task.id,
            loopId: task.loop,
            targetId: target.targetId,
            iteration: options.iteration,
            toolRound,
          },
          logger: log,
          tools: providerTools,
          toolChoice: `auto`,
          parallelToolCalls: true,
          messages,
        },
      );

      const choice = payload.choices?.[0];
      const responseMessage = choice?.message;
      const message = readOpenRouterContentText(responseMessage?.content).trim();
      const toolCalls = Array.isArray(responseMessage?.tool_calls) ? (responseMessage.tool_calls as OpenRouterToolCall[]) : [];
      const usageCostUsd = readOpenRouterUsageCostUsd(payload);

      llmCallCount += 1;
      llmCostUsd += usageCostUsd ?? 0;

      const llmTimelineEntry = makeLlmCallTimelineEntry(selectedPersona.displayName, {
        operation: `task-provider-execution`,
        status: `completed`,
        providerType: `openrouter`,
        model: target.model,
        messages,
        iteration: options.iteration,
        toolRound,
        finishReason: choice?.finish_reason ?? null,
        usageCostUsd,
        iterationCostUsdAccumulated: llmCostUsd,
        iterationCostLimitUsd: options.iterationCostLimitUsd,
        responseToolCalls: toolCalls,
        responseText: message,
        responsePayload: payload,
      });

      if (options.iterationCostLimitUsd !== null && llmCostUsd > options.iterationCostLimitUsd) {
        llmTimelineEntries.push({
          ...llmTimelineEntry,
          data: {
            ...llmTimelineEntry.data,
            status: `cost-limit-exceeded`,
            errorMessage: `Provider iteration cost limit exceeded after this LLM call.`,
          },
        });

        return {
          status: `blocked`,
          summary: `Provider iteration cost exceeded loop limit.`,
          output: `Iteration ${options.iteration} cost is $${llmCostUsd.toFixed(6)} and exceeded the configured limit of $${options.iterationCostLimitUsd.toFixed(6)}.`,
          blocker: `Provider iteration cost limit exceeded`,
          llmTimelineEntries,
          llmCostUsd,
          llmCallCount,
        };
      }

      if (toolCalls.length === 0 && !message) {
        llmTimelineEntries.push({
          ...llmTimelineEntry,
          data: {
            ...llmTimelineEntry.data,
            status: `invalid-response`,
            errorMessage: `Provider returned empty output.`,
          },
        });

        return {
          status: `blocked`,
          summary: `Provider returned empty output.`,
          output: `No message content was returned by provider execution.`,
          blocker: `Empty provider response`,
          llmTimelineEntries,
          llmCostUsd,
          llmCallCount,
        };
      }

      if (toolCalls.length > 0) {
        const toolRequests = toProviderToolRequests(toolCalls);
        const disallowedTool = toolRequests.find((request) => !isProviderBasedToolAllowed(request.tool));

        if (disallowedTool) {
          return {
            status: `blocked`,
            summary: `Provider requested a disallowed tool for provider-based execution.`,
            output: `Tool ${disallowedTool.tool} is not allowed in provider-based lane.`,
            blocker: `Disallowed provider-based tool request`,
            llmTimelineEntries,
            llmCostUsd,
            llmCallCount,
          };
        }

        const toolBatch = await executeProviderToolBatch(
          {
            taskId: task.id,
            loopId: task.loop,
            claimToken: task.claimToken,
          },
          toolRequests,
        );

        llmTimelineEntries.push(
          makeLlmCallTimelineEntry(selectedPersona.displayName, {
            operation: `task-provider-tool-batch`,
            status: toolBatch.hadError ? `completed-with-errors` : `completed`,
            toolRound,
            toolCalls,
            toolRequests,
            toolResults: toolBatch.results,
          }),
        );

        const toolMessages: OpenRouterMessage[] = toolBatch.results.map((result, index) => ({
          role: `tool`,
          name: result.tool,
          tool_call_id: toolCalls[index]?.id,
          content: JSON.stringify({ ok: result.ok, result: result.result, error: result.error }),
        }));

        messages = [
          ...messages,
          {
            role: `assistant`,
            content: responseMessage?.content === null ? null : message,
            tool_calls: toolCalls,
          },
          ...toolMessages,
        ];

        toolRound += 1;

        continue;
      }

      const autonomyResponse = parseProviderAutonomyResponse(message);

      if (!autonomyResponse) {
        llmTimelineEntries.push({
          ...llmTimelineEntry,
          data: {
            ...llmTimelineEntry.data,
            status: `invalid-response`,
            errorMessage: `Provider returned invalid autonomy response format.`,
          },
        });

        return {
          status: `blocked`,
          summary: `Provider returned invalid autonomy response format.`,
          output: message,
          blocker: `Invalid provider autonomy JSON response`,
          llmTimelineEntries,
          llmCostUsd,
          llmCallCount,
        };
      }

      llmTimelineEntries.push({
        ...llmTimelineEntry,
        data: {
          ...llmTimelineEntry.data,
          parsedResponse: autonomyResponse,
        },
      });

      return {
        status: autonomyResponse.achieved ? `completed` : `requires-user-input`,
        summary: autonomyResponse.summary,
        output: autonomyResponse.output,
        achieved: autonomyResponse.achieved,
        nextContext: autonomyResponse.nextContext,
        llmTimelineEntries,
        llmCostUsd,
        llmCallCount,
      };
    }

  } catch (error) {
    const llmTimelineEntry = makeLlmCallTimelineEntry(selectedPersona.displayName, {
      operation: `task-provider-execution`,
      status: `failed`,
      providerType: `openrouter`,
      model: target.model,
      messages,
      iteration: options.iteration,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStatus: error instanceof OpenRouterRequestError ? error.status : undefined,
      errorPayload: error instanceof OpenRouterRequestError ? error.payload : undefined,
    });

    if (error instanceof OpenRouterRequestError) {
      return {
        status: `blocked`,
        summary: `Provider execution failed (${error.status}).`,
        output: error.payload.error?.message ?? error.message,
        blocker: `Provider request failed with status ${error.status}`,
        llmTimelineEntries: [llmTimelineEntry],
        llmCostUsd,
        llmCallCount,
      };
    }

    const message = error instanceof Error ? error.message : String(error);

    return {
      status: `blocked`,
      summary: `Provider execution request errored.`,
      output: message,
      blocker: `Provider execution error`,
      llmTimelineEntries: [llmTimelineEntry],
      llmCostUsd,
      llmCallCount,
    };
  }
};

const executeRunnerRequest = async (task: Task, selectedPersona: Persona, target: RunnerExecutionTarget): Promise<TaskExecutionResult> => {
  if (target.definitionType !== `github-copilot-cloud`) {
    return {
      status: `blocked`,
      summary: `Unsupported runner type for execution in current phase.`,
      output: `Runner ${target.definitionType} is not executable in this phase.`,
      blocker: `Unsupported runner type: ${target.definitionType}`,
      llmTimelineEntries: [],
      llmCostUsd: 0,
      llmCallCount: 0,
    };
  }

  return {
    status: `requires-user-input`,
    summary: `${selectedPersona.displayName} dispatched to GitHub Copilot Cloud runner.`,
    output: [`Runner assignment accepted for ${selectedPersona.displayName}.`, `Objective: ${task.description}`, `Context: ${task.context}`, `Requested outcome: ${task.description ?? task.description}`].join(`\n`),
    llmTimelineEntries: [],
    llmCostUsd: 0,
    llmCallCount: 0,
  };
};

export const executeTaskTarget = async (task: Task, selectedPersona: Persona, target: ExecutionTarget, controls?: { iterationCostLimitUsd?: number | null }): Promise<TaskExecutionResult> => {
  if (target.targetType === `provider`) {
    const iteration = Math.max(1, task.autonomyIterationCount + 1);
    return executeProviderRequest(task, selectedPersona, target, {
      iteration,
      iterationCostLimitUsd: controls?.iterationCostLimitUsd ?? null,
    });
  }

  return executeRunnerRequest(task, selectedPersona, target);
};
