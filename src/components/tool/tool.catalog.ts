import { optionalString, requiredString, uuid } from "@components/utilities/zod.utilities.js";
import { z } from "zod";

export type ProviderToolInput = Record<string, unknown>;

export type ProviderToolDefinition = {
  name: string;
  label: string;
  description: string;
  configurable?: boolean;
  requiresApproval: boolean;
  inputSchema: z.ZodType<ProviderToolInput>;
};

const workgraphInputSchema = z.object({
  workgraph: uuid(`workgraph must be a valid UUID.`).describe(`Workgraph id.`),
});

const workgraphItemInputSchema = workgraphInputSchema
  .extend({
    item: uuid(`item must be a valid UUID.`).describe(`Workgraph item id.`),
  })
  .strict();

export const providerToolDefinitions: ReadonlyArray<ProviderToolDefinition> = [
  {
    name: `own-memory-lookup`,
    label: `Look Up Loop Memory`,
    description: `Search the current loop's own persisted conversation and service history for relevant prior context. This tool can never search another loop.`,
    configurable: false,
    requiresApproval: false,
    inputSchema: z
      .object({
        query: requiredString(`query is required.`).describe(`Semantic query describing the prior loop context to recall.`),
        limit: z.number().int().min(1).max(20).optional().describe(`Maximum memory entries to return. Defaults to 5.`),
      })
      .strict(),
  },
  {
    name: `task_repositories`,
    label: `List Repositories`,
    description: `List repositories available for the current task.`,
    requiresApproval: false,
    inputSchema: z.object({}).strict(),
  },
  {
    name: `task_runners`,
    label: `List Compatible Runners`,
    description: `List loop runners compatible with a repository available for the current task.`,
    requiresApproval: false,
    inputSchema: z
      .object({
        repository: optionalString.describe(`Repository selector (id, display name, or owner/repo). Defaults to the first available task repository.`),
      })
      .strict(),
  },
  {
    name: `task_workgraphs`,
    label: `List Workgraphs`,
    description: `List workgraphs available for the current task.`,
    requiresApproval: false,
    inputSchema: z.object({}).strict(),
  },
  {
    name: `repo_ls`,
    label: `List Repository Path`,
    description: `List files and directories in a repository available for this task.`,
    requiresApproval: false,
    inputSchema: z
      .object({
        repository: requiredString(`must be a non-empty string.`).describe(`Repository to list.`),
        path: requiredString(`must be a non-empty string.`).describe(`Directory path to list within the repository.`),
      })
      .strict(),
  },
  {
    name: `repo_read`,
    label: `Read Repository File`,
    description: `Read a file from a repository available for this task.`,
    requiresApproval: false,
    inputSchema: z
      .object({
        repository: requiredString(`must be a non-empty string.`).describe(`Repository to read from.`),
        path: requiredString(`must be a non-empty string.`).describe(`File path to read.`),
        startLine: z.number().int().min(1).optional().describe(`First line to include.`),
        endLine: z.number().int().min(1).optional().describe(`Last line to include.`),
        maxLines: z.number().int().min(1).max(2000).optional().describe(`Maximum number of lines to return.`),
      })
      .strict(),
  },
  {
    name: `repo_search`,
    label: `Search Repository Code`,
    description: `Search code in a repository available for this task using GitHub code search.`,
    requiresApproval: false,
    inputSchema: z
      .object({
        repository: requiredString(`must be a non-empty string.`).describe(`Repository to search in.`),
        query: requiredString(`must be a non-empty string.`).describe(`GitHub code search query.`),
        path: requiredString(`must be a non-empty string.`).describe(`Path prefix to limit the search.`),
        caseSensitive: z.boolean().optional().describe(`Match case exactly when true.`),
        maxMatches: z.number().int().min(1).max(500).optional().describe(`Maximum matches to return.`),
      })
      .strict(),
  },
  {
    name: `repo_find`,
    label: `Find Repository Files`,
    description: `Find files in a repository available for this task by regex pattern.`,
    requiresApproval: false,
    inputSchema: z
      .object({
        repository: requiredString(`must be a non-empty string.`).describe(`Repository to search in.`),
        pattern: requiredString(`must be a non-empty string.`).describe(`Regular expression used to match file paths.`),
        flags: optionalString.describe(`Regular expression flags.`),
        path: optionalString.describe(`Optional path prefix to limit matching.`),
        maxMatches: z.number().int().min(1).max(1000).optional().describe(`Maximum matches to return.`),
      })
      .strict(),
  },
  {
    name: `repo_symbol_index`,
    label: `Index Repository Symbols`,
    description: `Find symbol occurrences in repository files with identifier-aware matching and line-level hits.`,
    requiresApproval: false,
    inputSchema: z
      .object({
        repository: requiredString(`must be a non-empty string.`).describe(`Repository to search in.`),
        symbol: requiredString(`must be a non-empty string.`).describe(`Symbol to locate.`),
        path: optionalString.describe(`Optional path prefix to limit matching.`),
        caseSensitive: z.boolean().optional().describe(`Match case exactly when true.`),
        maxMatches: z.number().int().min(1).max(200).optional().describe(`Maximum matches to return.`),
      })
      .strict(),
  },
  {
    name: `workgraph_refresh`,
    label: `Refresh Workgraph`,
    description: `Refresh a workgraph by id. A workgraph is the item-backed view this loop uses to organize work. Its backing store can drift or become stale, so refresh pulls in new items and updates changed ones from the source of truth.`,
    requiresApproval: false,
    inputSchema: workgraphInputSchema,
  },
  {
    name: `workgraph_read_item`,
    label: `Read Workgraph Item`,
    description: `Read details for a workgraph item by database item id.`,
    requiresApproval: false,
    inputSchema: workgraphItemInputSchema,
  },
  {
    name: `workgraph_assign_task_item`,
    label: `Assign Task to Workgraph Item`,
    description: `Assign the current task to a workgraph item by database item id.`,
    requiresApproval: true,
    inputSchema: workgraphItemInputSchema,
  },
  {
    name: `workgraph_search_items`,
    label: `Search Workgraph Items`,
    description: `Search workgraph items using a query.`,
    requiresApproval: false,
    inputSchema: z
      .object({
        workgraph: uuid(`workgraph must be a valid UUID.`).describe(`Workgraph id.`),
        query: optionalString.describe(`Workgraph query filter.`),
        maxResults: z.number().int().min(1).max(100).optional().describe(`Maximum items to return.`),
      })
      .strict(),
  },
  {
    name: `workgraph_create_item`,
    label: `Create Workgraph Item`,
    description: `Create a workgraph item using default and optional custom fields.`,
    requiresApproval: true,
    inputSchema: z
      .object({
        workgraph: uuid(`workgraph must be a valid UUID.`).describe(`Workgraph id.`),
        summary: requiredString(`must be a non-empty string.`).describe(`Item summary.`),
        projectKey: optionalString.describe(`Project key to create the item in.`),
        itemTypeId: optionalString.describe(`Item type id.`),
        itemType: optionalString.describe(`Item type name.`),
        description: optionalString.describe(`Item description.`),
        parentKey: optionalString.describe(`Parent item key.`),
        parentId: optionalString.describe(`Parent item id.`),
        labels: z.array(requiredString(`must be a non-empty string.`).describe(`Label text.`)).optional().describe(`Labels to apply to the new item.`),
        fieldUpdates: z
          .array(
            z
              .object({
                fieldId: requiredString(`must be a non-empty string.`).describe(`Workgraph field id.`),
                value: z.unknown().describe(`Field value.`),
              })
              .strict(),
          )
          .optional()
          .describe(`Structured field updates to merge into the created item.`),
        fields: z.record(z.string(), z.unknown()).optional().describe(`Additional raw workgraph fields to merge into the created item.`),
      })
      .strict()
      .refine((value) => Boolean(value.itemTypeId || value.itemType), {
        message: `itemTypeId or itemType is required.`,
      }),
  },
  {
    name: `workgraph_add_labels`,
    label: `Add Workgraph Labels`,
    description: `Add labels to a workgraph item.`,
    requiresApproval: true,
    inputSchema: workgraphItemInputSchema.extend({ labels: z.array(requiredString(`must be a non-empty string.`).describe(`Label text.`)).min(1).describe(`Labels to add.`) }).strict(),
  },
  {
    name: `workgraph_remove_labels`,
    label: `Remove Workgraph Labels`,
    description: `Remove labels from a workgraph item.`,
    requiresApproval: true,
    inputSchema: workgraphItemInputSchema.extend({ labels: z.array(requiredString(`must be a non-empty string.`).describe(`Label text.`)).min(1).describe(`Labels to remove.`) }).strict(),
  },
  {
    name: `workgraph_list_transitions`,
    label: `List Workgraph Transitions`,
    description: `List available transitions for a workgraph item.`,
    requiresApproval: false,
    inputSchema: workgraphItemInputSchema,
  },
  {
    name: `workgraph_transition_item`,
    label: `Transition Workgraph Item`,
    description: `Transition a workgraph item to another state.`,
    requiresApproval: true,
    inputSchema: workgraphItemInputSchema.extend({ transitionId: requiredString(`must be a non-empty string.`).describe(`Transition id.`) }).strict(),
  },
  {
    name: `workgraph_list_fields`,
    label: `List Workgraph Fields`,
    description: `List available workgraph fields with ids and schema hints.`,
    requiresApproval: false,
    inputSchema: workgraphInputSchema,
  },
  {
    name: `workgraph_edit_field`,
    label: `Edit Workgraph Field`,
    description: `Edit a workgraph item field by fieldId.`,
    requiresApproval: true,
    inputSchema: workgraphItemInputSchema
      .extend({
        fieldId: requiredString(`must be a non-empty string.`).describe(`Workgraph field id.`),
        value: requiredString(`must be a non-empty string.`).describe(`New field value.`),
      })
      .strict(),
  },
  {
    name: `workgraph_add_comment`,
    label: `Add Workgraph Comment`,
    description: `Add a comment to a workgraph item.`,
    requiresApproval: true,
    inputSchema: workgraphItemInputSchema.extend({ comment: requiredString(`must be a non-empty string.`).describe(`Comment text.`) }).strict(),
  },
  {
    name: `athena_mark_complete`,
    label: `Mark Task Complete`,
    description: `Mark the current task as complete. The task will be closed immediately upon approval.`,
    requiresApproval: true,
    inputSchema: z
      .object({
        note: optionalString.describe(`Optional completion note.`),
      })
      .strict(),
  },
  {
    name: `athena_compact_queue`,
    label: `Compact Task Queue`,
    description: `Compress the task conversation history into a persistent summary and remove already-completed queue items up to the first pending item. This serves as compaction and summarization of the task's conversation history, preserving the current state, decisions, blockers, and next actions.`,
    requiresApproval: true,
    inputSchema: z
      .object({
        summary: requiredString(`must be a non-empty string.`).describe(`Concise summary of the conversation so far, preserving current state, decisions, blockers, and next actions.`),
      })
      .strict(),
  },
  {
    name: `athena_define_objective`,
    label: `Define Task Objective`,
    description: `Set or update the current objective for this task.`,
    requiresApproval: true,
    inputSchema: z
      .object({
        objective: requiredString(`must be a non-empty string.`).describe(`The new objective for this task.`),
      })
      .strict(),
  },
  {
    name: `athena_define_title`,
    label: `Define Task Title`,
    description: `Set or update the title for this task.`,
    requiresApproval: true,
    inputSchema: z
      .object({
        title: requiredString(`must be a non-empty string.`).describe(`The new title for this task.`),
      })
      .strict(),
  },
  {
    name: `athena_get_objective`,
    label: `Get Task Objective`,
    description: `Get the current objective for this task.`,
    requiresApproval: false,
    inputSchema: z.object({}).strict(),
  },
  {
    name: `athena_get_title`,
    label: `Get Task Title`,
    description: `Get the current title for this task.`,
    requiresApproval: false,
    inputSchema: z.object({}).strict(),
  },
  {
    name: `athena_list_models`,
    label: `List Available Models`,
    description: `List models enabled on the current task's provider, including description, pricing, context length, and capability details.`,
    requiresApproval: false,
    inputSchema: z.object({}).strict(),
  },
  {
    name: `athena_list_personas`,
    label: `List Available Personas`,
    description: `List all personas available in this loop. Use persona IDs from this list as input to athena_ask_other_persona.`,
    requiresApproval: false,
    inputSchema: z.object({}).strict(),
  },
  {
    name: `athena_ask_other_persona`,
    label: `Ask Another Persona`,
    description: `Consult another persona in this loop by providing a context summary and a prompt. The persona's response is appended to the task history attributed to that persona and also returned as the tool result.`,
    requiresApproval: false,
    inputSchema: z
      .object({
        personaId: uuid(`personaId must be a valid UUID.`).describe(`ID of the persona to consult. Call athena_list_personas first to discover available personas.`),
        model: requiredString(`must be a non-empty string.`).describe(`Model ID to use for the consultation. Call athena_list_models first to discover available models.`),
        summary: requiredString(`must be a non-empty string.`).describe(`Concise context summary giving the consulted persona enough background to answer.`),
        prompt: requiredString(`must be a non-empty string.`).describe(`The question or task to ask the consulted persona.`),
      })
      .strict(),
  },
  {
    name: `athena_assign_to_workgraph_item`,
    label: `Assign Task to Workgraph Item`,
    description: `Assign the current task to a workgraph item in this loop. Only items belonging to this loop's workgraphs are valid. Requires user approval before execution.`,
    requiresApproval: true,
    inputSchema: z
      .object({
        item: uuid(`item must be a valid UUID.`).describe(`Workgraph item id to assign this task to.`),
      })
      .strict(),
  },
  {
    name: `athena_enqueue_run`,
    label: `Enqueue Runner`,
    description: `Dispatch an agentic coding task to a runner harness (GitHub Copilot Cloud). Call task_repositories and task_runners first to choose a compatible repository/runner combination. Provide a self-contained prompt with all necessary context and a step-by-step plan. The task will pause after this call and resume automatically when the runner finishes — do not attempt further tool calls or responses after invoking this tool. Requires user approval before execution.`,
    requiresApproval: true,
    inputSchema: z
      .object({
        prompt: requiredString(`prompt is required.`).describe(`Full task context and instructions for the runner harness.`),
        plan: requiredString(`plan is required.`).describe(`Step-by-step plan for the runner to follow.`),
        repository: requiredString(`repository is required.`).describe(`Target repository selector (id, display name, or owner/repo). Use task_repositories to discover available repositories.`),
        runner: uuid(`runner must be a valid UUID.`).optional().describe(`Optional runner id from task_runners output. If omitted, Athena selects a compatible runner by loop policy.`),
      })
      .strict(),
  },
];

const providerToolDefinitionByName = new Map(providerToolDefinitions.map((tool) => [tool.name, tool]));

export const providerToolNames: ReadonlyArray<string> = providerToolDefinitions.map((tool) => tool.name);

const providerToolNameSet = new Set(providerToolNames);
const approvalRequiredToolNameSet = new Set(providerToolDefinitions.filter((tool) => tool.requiresApproval).map((tool) => tool.name));

export const isKnownProviderToolName = (toolName: string): boolean => providerToolNameSet.has(toolName);

export const isProviderToolRequiringApproval = (toolName: string): boolean => approvalRequiredToolNameSet.has(toolName);

export const normalizeProviderToolNames = (toolNames: ReadonlyArray<string>): string[] => {
  const uniqueRequested = new Set(toolNames);
  return providerToolNames.filter((toolName) => uniqueRequested.has(toolName));
};

export const enabledProviderToolNamesFromDisabled = (disabledToolNames: ReadonlyArray<string>): string[] => {
  const normalizedDisabled = new Set(normalizeProviderToolNames(disabledToolNames));
  return providerToolNames.filter((toolName) => !normalizedDisabled.has(toolName));
};

export const enabledProviderToolDefinitionsFromDisabled = (disabledToolNames: ReadonlyArray<string>): ProviderToolDefinition[] => {
  const enabledToolNameSet = new Set(enabledProviderToolNamesFromDisabled(disabledToolNames));
  return providerToolDefinitions.filter((tool) => enabledToolNameSet.has(tool.name));
};

export const disabledProviderToolNamesFromEnabled = (enabledToolNames: ReadonlyArray<string>): string[] => {
  const normalizedEnabled = new Set(normalizeProviderToolNames(enabledToolNames));
  return providerToolDefinitions.filter((tool) => tool.configurable !== false && !normalizedEnabled.has(tool.name)).map((tool) => tool.name);
};

export const providerToolInputSchemas: Record<string, z.ZodType<ProviderToolInput>> = Object.fromEntries(providerToolDefinitions.map((tool) => [tool.name, tool.inputSchema])) as Record<string, z.ZodType<ProviderToolInput>>;

export const providerToolLabelByName = (toolName: string): string => providerToolDefinitionByName.get(toolName)?.label ?? toolName;

export const providerToolInputSchemaByName = (toolName: string): z.ZodType<ProviderToolInput> | undefined => providerToolDefinitionByName.get(toolName)?.inputSchema;

export const providerToolParametersFromInputSchema = (schema: z.ZodType<ProviderToolInput>): Record<string, unknown> => {
  const jsonSchema = z.toJSONSchema(schema);

  if (jsonSchema && typeof jsonSchema === `object` && !Array.isArray(jsonSchema)) {
    const { $schema: _schema, ...parameters } = jsonSchema as Record<string, unknown> & { $schema?: unknown };
    return parameters;
  }

  return {
    type: `object`,
    properties: {},
    additionalProperties: false,
  };
};
