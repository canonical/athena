import { log } from "@components/logging/logging.service.js";
import type { OpenRouterMessage } from "@components/openrouter/openrouter.schema.js";
import { fetchOpenRouterChatCompletion, OpenRouterRequestError, readOpenRouterContentText } from "@components/openrouter/openrouter.service.js";
import type { Persona } from "@components/persona/persona.schema.js";
import { v7 as uuidv7 } from "uuid";
import { buildTaskConversationMessages, buildTaskOpenRouterSessionId } from "./task.history.js";
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
};

type ProviderAutonomyResponse = {
  achieved: boolean;
  summary: string;
  output: string;
  nextContext?: string;
};

type ProviderExecutionOptions = {
  iteration: number;
  maxIterations: number;
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

const buildStablePersonaSystemPrompt = (task: Task, selectedPersona: Persona): string =>
  [`You are ${selectedPersona.displayName}.`, selectedPersona.role ? `Role: ${selectedPersona.role}.` : null, `Personality guidance: ${selectedPersona.personality}`, `Current objective: ${task.description}`].filter(Boolean).join(`\n`);

const buildStableAutonomyContractPrompt = (): string =>
  [
    `Return only strict JSON with keys: achieved (boolean), summary (string), output (string), nextContext (string, optional).`,
    `Do not include markdown, code fences, or any keys other than achieved, summary, output, nextContext.`,
    `Set achieved=true only when objective is fully achieved.`,
  ].join(`\n`);

const buildStableRequestedOutcomePrompt = (task: Task): string => `Requested outcome: ${task.description ?? task.description}`;

const buildVolatileIterationPrompt = (task: Task, options: ProviderExecutionOptions): string => [`Iteration ${options.iteration} of ${options.maxIterations}.`, `Current context: ${task.context}`].join(`\n`);

const buildProviderMessages = (task: Task, selectedPersona: Persona, options: ProviderExecutionOptions): OpenRouterMessage[] => [
  {
    role: `system`,
    content: buildStablePersonaSystemPrompt(task, selectedPersona),
  },
  {
    role: `system`,
    content: buildStableAutonomyContractPrompt(),
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
    };
  }

  const messages = buildProviderMessages(task, selectedPersona, options);

  try {
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
          maxIterations: options.maxIterations,
        },
        logger: log,
        messages,
      },
    );

    const message = readOpenRouterContentText(payload.choices?.[0]?.message?.content).trim();
    const llmTimelineEntry = makeLlmCallTimelineEntry(selectedPersona.displayName, {
      operation: `task-provider-execution`,
      status: `completed`,
      providerType: `openrouter`,
      model: target.model,
      messages,
      iteration: options.iteration,
      maxIterations: options.maxIterations,
      responseText: message,
      responsePayload: payload,
    });

    if (!message) {
      return {
        status: `blocked`,
        summary: `Provider returned empty output.`,
        output: `No message content was returned by provider execution.`,
        blocker: `Empty provider response`,
        llmTimelineEntries: [
          {
            ...llmTimelineEntry,
            data: {
              ...llmTimelineEntry.data,
              status: `invalid-response`,
              errorMessage: `Provider returned empty output.`,
            },
          },
        ],
      };
    }

    const autonomyResponse = parseProviderAutonomyResponse(message);

    if (!autonomyResponse) {
      return {
        status: `blocked`,
        summary: `Provider returned invalid autonomy response format.`,
        output: message,
        blocker: `Invalid provider autonomy JSON response`,
        llmTimelineEntries: [
          {
            ...llmTimelineEntry,
            data: {
              ...llmTimelineEntry.data,
              status: `invalid-response`,
              errorMessage: `Provider returned invalid autonomy response format.`,
            },
          },
        ],
      };
    }

    return {
      status: autonomyResponse.achieved ? `completed` : `requires-user-input`,
      summary: autonomyResponse.summary,
      output: autonomyResponse.output,
      achieved: autonomyResponse.achieved,
      nextContext: autonomyResponse.nextContext,
      llmTimelineEntries: [
        {
          ...llmTimelineEntry,
          data: {
            ...llmTimelineEntry.data,
            parsedResponse: autonomyResponse,
          },
        },
      ],
    };
  } catch (error) {
    const llmTimelineEntry = makeLlmCallTimelineEntry(selectedPersona.displayName, {
      operation: `task-provider-execution`,
      status: `failed`,
      providerType: `openrouter`,
      model: target.model,
      messages,
      iteration: options.iteration,
      maxIterations: options.maxIterations,
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
      };
    }

    const message = error instanceof Error ? error.message : String(error);

    return {
      status: `blocked`,
      summary: `Provider execution request errored.`,
      output: message,
      blocker: `Provider execution error`,
      llmTimelineEntries: [llmTimelineEntry],
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
    };
  }

  return {
    status: `requires-user-input`,
    summary: `${selectedPersona.displayName} dispatched to GitHub Copilot Cloud runner.`,
    output: [`Runner assignment accepted for ${selectedPersona.displayName}.`, `Objective: ${task.description}`, `Context: ${task.context}`, `Requested outcome: ${task.description ?? task.description}`].join(`\n`),
    llmTimelineEntries: [],
  };
};

export const executeTaskTarget = async (task: Task, selectedPersona: Persona, target: ExecutionTarget): Promise<TaskExecutionResult> => {
  if (target.targetType === `provider`) {
    const iteration = Math.max(1, task.autonomyIterationCount + 1);
    return executeProviderRequest(task, selectedPersona, target, {
      iteration,
      maxIterations: Math.max(1, task.autonomyMaxIterations),
    });
  }

  return executeRunnerRequest(task, selectedPersona, target);
};
