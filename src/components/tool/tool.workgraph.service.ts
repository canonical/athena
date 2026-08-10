import { queryTaskAssignWorkgraphItem } from "@components/task/task.service.js";
import { fetchWithRetry } from "@components/utilities/http-retry.js";
import { readWorkDoneLabelFromAssignmentConfig, readWorkInProgressLabelFromAssignmentConfig, readWorkOnLabelFromAssignmentConfig } from "@components/workgraph/workgraph.assignment-config.js";
import { queryLoopWorkgraphItemById, queryLoopWorkgraphItemList, queryLoopWorkgraphList, queryLoopWorkgraphSyncConnection } from "@components/workgraph/workgraph.pg.service.js";
import { synchronizeLoopWorkgraphAndPromoteTasks } from "@components/workgraph/workgraph.sync.service.js";
import type { ProviderToolExecutionContext } from "./tool.schema.js";

const makeJiraBasicAuthHeader = (email: string, apiKey: string): string => {
  const token = Buffer.from(`${email}:${apiKey}`).toString("base64");
  return `Basic ${token}`;
};

type WorkgraphConnection = Awaited<ReturnType<typeof resolveWorkgraphConnectionForInput>>;

type JiraFetchInput = {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  jsonBody?: unknown;
  headers?: Record<string, string>;
};

type JiraFetchRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  allowRetryOnNonIdempotentMethods?: boolean;
};

const buildJiraApiUrl = (connection: WorkgraphConnection, path: string): string => {
  return `${connection.baseUrl.replace(/\/+$/u, "")}${path}`;
};

const fetchJira = async (connection: WorkgraphConnection, input: JiraFetchInput, retryOptions?: JiraFetchRetryOptions): Promise<Response> => {
  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    Authorization: makeJiraBasicAuthHeader(connection.email, connection.apiKey),
    ...(input.headers ?? {}),
  };

  if (typeof input.jsonBody !== "undefined") {
    requestHeaders["Content-Type"] = requestHeaders["Content-Type"] ?? "application/json";
  }

  return fetchWithRetry(
    buildJiraApiUrl(connection, input.path),
    {
      method: input.method ?? "GET",
      headers: requestHeaders,
      body: typeof input.jsonBody === "undefined" ? undefined : JSON.stringify(input.jsonBody),
    },
    {
      maxAttempts: retryOptions?.maxAttempts ?? 4,
      baseDelayMs: retryOptions?.baseDelayMs ?? 500,
      maxDelayMs: retryOptions?.maxDelayMs ?? 8_000,
      allowRetryOnNonIdempotentMethods: retryOptions?.allowRetryOnNonIdempotentMethods,
    },
  );
};

const parseInteger = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const resolveWorkgraphId = (input: Record<string, unknown> | undefined, errorMessage: string): string => {
  const workgraph = typeof input?.workgraph === "string" ? input.workgraph.trim() : "";

  if (!workgraph) {
    throw new Error(errorMessage);
  }

  return workgraph;
};

const resolveWorkgraphItemId = (input: Record<string, unknown> | undefined, errorMessage: string): string => {
  const item = typeof input?.item === "string" ? input.item.trim() : "";

  if (!item) {
    throw new Error(errorMessage);
  }

  return item;
};

const resolveWorkgraphConnectionForInput = async (loopId: string, input: Record<string, unknown> | undefined) => {
  const workgraphId = resolveWorkgraphId(input, "workgraph is required.");
  const loopWorkgraphs = await queryLoopWorkgraphList(loopId);
  const selectedWorkgraph = loopWorkgraphs.find((entry) => entry.workgraph === workgraphId);

  if (!selectedWorkgraph) {
    throw new Error("The selected workgraph is not assigned to this loop.");
  }

  if (!selectedWorkgraph.enabled) {
    throw new Error("Workgraph assignment is disabled.");
  }

  const connection = await queryLoopWorkgraphSyncConnection(loopId, workgraphId);

  if (!connection) {
    throw new Error("Workgraph connection metadata not found for the selected workgraph.");
  }

  if (connection.type !== "jira") {
    throw new Error(`Unsupported workgraph type: ${connection.type}.`);
  }

  return connection;
};

const resolveWorkgraphItemForInput = async (loopId: string, input: Record<string, unknown> | undefined, errorMessage: string) => {
  const workgraphId = resolveWorkgraphId(input, "workgraph is required.");
  const itemId = resolveWorkgraphItemId(input, errorMessage);
  const item = await queryLoopWorkgraphItemById(loopId, workgraphId, itemId);

  if (!item) {
    throw new Error("Workgraph item not found for the selected workgraph.");
  }

  return { workgraphId, item };
};

const readAllowedLoopLabels = (assignmentConfig: unknown): string[] => {
  const labels = [readWorkOnLabelFromAssignmentConfig(assignmentConfig), readWorkInProgressLabelFromAssignmentConfig(assignmentConfig), readWorkDoneLabelFromAssignmentConfig(assignmentConfig)];

  const deduplicated: string[] = [];
  for (const label of labels) {
    if (!deduplicated.includes(label)) {
      deduplicated.push(label);
    }
  }

  return deduplicated;
};

const assertLabelsAllowedForLoop = (labels: string[], assignmentConfig: unknown): void => {
  const allowedLabels = readAllowedLoopLabels(assignmentConfig);
  const allowedLabelSet = new Set(allowedLabels.map((label) => label.toLowerCase()));
  const disallowed = labels.filter((label) => !allowedLabelSet.has(label.toLowerCase()));

  if (disallowed.length > 0) {
    throw new Error(`Only loop-configured labels are allowed. Rejected: ${disallowed.join(", ")}. Allowed: ${allowedLabels.join(", ")}.`);
  }
};

// ============================================================================
// Approval Description Helpers - Provide human-readable context for tool approvals
// ============================================================================

/**
 * Generate a human-readable description for workgraph transition approval.
 * Attempts to resolve the transition ID to a human-readable name.
 */
export const buildJiraTransitionApprovalDescription = async (loopId: string, workgraphId: string, itemKey: string, transitionId: string): Promise<string> => {
  try {
    const connection = await resolveWorkgraphConnectionForInput(loopId, { workgraph: workgraphId });
    const response = await fetchJira(connection, {
      path: `/rest/api/3/issue/${encodeURIComponent(itemKey)}/transitions`,
    });

    if (response.ok) {
      const payload = (await response.json().catch(() => null)) as { transitions?: unknown[] } | null;
      const transitions = Array.isArray(payload?.transitions) ? payload.transitions : [];
      const transition = transitions.find((t): t is Record<string, unknown> => isRecord(t) && t.id === transitionId);

      if (transition) {
        const name = typeof transition.name === "string" ? transition.name : "";
        const toStatus = transition.to && typeof transition.to === "object" ? (transition.to as { name?: unknown }).name : null;
        const statusText = typeof toStatus === "string" && toStatus ? ` → ${toStatus}` : "";
        return `Transition item ${itemKey} to "${name}"${statusText}`;
      }
    }
  } catch {
    // Fall back to generic description if lookup fails
  }

  return `Transition item ${itemKey} to state ${transitionId}`;
};

/**
 * Generate a human-readable description for workgraph field edit approval.
 * Attempts to resolve the field ID to a human-readable label.
 */
export const buildJiraEditFieldApprovalDescription = async (loopId: string, workgraphId: string, itemKey: string, fieldId: string, value: string): Promise<string> => {
  try {
    const connection = await resolveWorkgraphConnectionForInput(loopId, { workgraph: workgraphId });
    const response = await fetchJira(connection, { path: "/rest/api/3/field" });

    if (response.ok) {
      const fields = (await response.json().catch(() => null)) as Array<{
        id?: unknown;
        name?: unknown;
      }> | null;
      const field = Array.isArray(fields) ? fields.find((f): f is Record<string, unknown> => isRecord(f) && f.id === fieldId) : null;

      if (field && typeof field.name === "string") {
        return `Edit field "${field.name}" of item ${itemKey} to: "${value}"`;
      }
    }
  } catch {
    // Fall back to generic description if lookup fails
  }

  return `Edit field ${fieldId} of item ${itemKey} to: "${value}"`;
};

/**
 * Generate a human-readable description for workgraph item creation approval.
 */
export const buildJiraCreateIssueApprovalDescription = (input: Record<string, unknown>): string => {
  const summary = typeof input.summary === "string" ? input.summary : "(no summary)";
  const itemType = typeof input.itemType === "string" ? input.itemType : "";
  const typeText = itemType ? ` as ${itemType}` : "";
  return `Create new workgraph item${typeText}: "${summary}"`;
};

/**
 * Generate a human-readable description for workgraph label add approval.
 */
export const buildJiraAddLabelsApprovalDescription = (itemKey: string, labels: string[]): string => {
  return `Add ${labels.length} label${labels.length !== 1 ? "s" : ""} to item ${itemKey}: ${labels.map((l) => `"${l}"`).join(", ")}`;
};

/**
 * Generate a human-readable description for workgraph label remove approval.
 */
export const buildJiraRemoveLabelsApprovalDescription = (itemKey: string, labels: string[]): string => {
  return `Remove ${labels.length} label${labels.length !== 1 ? "s" : ""} from item ${itemKey}: ${labels.map((l) => `"${l}"`).join(", ")}`;
};

/**
 * Generate a human-readable description for workgraph comment approval.
 */
export const buildJiraAddCommentApprovalDescription = (itemKey: string, commentText: string): string => {
  const preview = commentText.length > 60 ? `${commentText.substring(0, 57)}...` : commentText;
  return `Add comment to item ${itemKey}: "${preview}"`;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const doesSearchValueMatch = (value: unknown, normalizedQuery: string): boolean => {
  if (value === null || typeof value === "undefined") {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase().includes(normalizedQuery);
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value).toLowerCase().includes(normalizedQuery);
  }

  if (value instanceof Date) {
    return value.toISOString().toLowerCase().includes(normalizedQuery);
  }

  return false;
};

const itemMatchesSearchQuery = (value: unknown, normalizedQuery: string, seen: WeakSet<object>): boolean => {
  if (doesSearchValueMatch(value, normalizedQuery)) {
    return true;
  }

  if (value === null || typeof value === "undefined") {
    return false;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (itemMatchesSearchQuery(entry, normalizedQuery, seen)) {
        return true;
      }
    }

    return false;
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return false;
    }

    seen.add(value);

    for (const entry of Object.values(value)) {
      if (itemMatchesSearchQuery(entry, normalizedQuery, seen)) {
        return true;
      }
    }
  }

  return false;
};

type JiraRichTextDocument = {
  type: "doc";
  version: 1;
  content: Array<{
    type: "paragraph";
    content: Array<{ type: "text"; text: string }>;
  }>;
};

const toJiraRichTextDocument = (text: string): JiraRichTextDocument => {
  const lines = text.split(/\r?\n/u);
  const paragraphs = lines.length > 0 ? lines : [``];

  return {
    type: "doc",
    version: 1,
    content: paragraphs.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  };
};

const updateJiraIssueFields = async (input: { connection: WorkgraphConnection; issueRef: string; fields: Record<string, unknown>; operationName: string }): Promise<void> => {
  const response = await fetchJira(
    input.connection,
    {
      path: `/rest/api/3/issue/${encodeURIComponent(input.issueRef)}`,
      method: "PUT",
      jsonBody: { fields: input.fields },
    },
    {
      maxAttempts: 3,
      baseDelayMs: 600,
      maxDelayMs: 8_000,
      allowRetryOnNonIdempotentMethods: true,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${input.operationName} failed (${response.status}): ${detail || response.statusText}`);
  }
};

export const executeTaskWorkgraphs = async (context: ProviderToolExecutionContext): Promise<unknown> => {
  const loopWorkgraphs = await queryLoopWorkgraphList(context.loopId);
  const enabled = loopWorkgraphs.filter((entry) => entry.enabled);

  if (enabled.length === 0) {
    throw new Error("No enabled workgraph assignment is available for this loop.");
  }

  return {
    total: enabled.length,
    workgraphs: enabled.map((entry) => ({
      workgraphId: entry.workgraph,
      name: entry.name,
      type: entry.type,
      baseUrl: entry.baseUrl,
      browseBaseUrl: entry.browseBaseUrl,
      projectKey: entry.projectKey,
      lastSyncedAt: entry.lastSyncedAt,
      lastSyncStatus: entry.lastSyncStatus,
    })),
  };
};

export const executeWorkgraphFieldList = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const connection = await resolveWorkgraphConnectionForInput(context.loopId, input);
  const response = await fetchJira(connection, { path: "/rest/api/3/field" });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`workgraph_list_fields failed (${response.status}): ${detail || response.statusText}`);
  }

  const fields = (await response.json().catch(() => null)) as Array<{
    id?: unknown;
    name?: unknown;
    custom?: unknown;
    schema?: unknown;
  }> | null;

  const normalized = (Array.isArray(fields) ? fields : [])
    .filter((field) => field && typeof field === "object")
    .map((field) => {
      const id = typeof field.id === "string" ? field.id.trim() : "";
      const name = typeof field.name === "string" ? field.name.trim() : "";
      const custom = field.custom === true;
      const schema = field.schema && typeof field.schema === "object" ? (field.schema as Record<string, unknown>) : undefined;
      const schemaType = typeof schema?.type === "string" ? schema.type : null;
      const schemaSystem = typeof schema?.system === "string" ? schema.system : null;
      const schemaCustom = typeof schema?.custom === "string" ? schema.custom : null;

      return {
        id,
        name,
        custom,
        schemaType,
        schemaSystem,
        schemaCustom,
      };
    })
    .filter((field) => field.id.length > 0 && field.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    workgraph: connection.workgraph,
    total: normalized.length,
    fields: normalized,
  };
};

export const executeWorkgraphRefresh = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const connection = await resolveWorkgraphConnectionForInput(context.loopId, input);
  const result = await synchronizeLoopWorkgraphAndPromoteTasks(context.loopId, connection.workgraph);

  return {
    ok: true,
    workgraph: connection.workgraph,
    workgraphType: connection.type,
    refreshed: true,
    syncedCount: result.syncedCount,
    createdTaskCount: result.createdTaskCount,
    message: `Refreshed the workgraph. Synced ${result.syncedCount} item${result.syncedCount === 1 ? "" : "s"} and created ${result.createdTaskCount} task${result.createdTaskCount === 1 ? "" : "s"}.`,
  };
};

export const executeWorkgraphCreateItem = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const connection = await resolveWorkgraphConnectionForInput(context.loopId, input);
  const summary = typeof input?.summary === "string" ? input.summary.trim() : "";
  const itemTypeId = typeof input?.itemTypeId === "string" ? input.itemTypeId.trim() : "";
  const itemType = typeof input?.itemType === "string" ? input.itemType.trim() : "";
  const explicitProjectKey = typeof input?.projectKey === "string" ? input.projectKey.trim() : "";
  const projectKey = explicitProjectKey || connection.projectKey?.trim() || "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  const parentKey = typeof input?.parentKey === "string" ? input.parentKey.trim() : "";
  const parentId = typeof input?.parentId === "string" ? input.parentId.trim() : "";
  const requestedLabels = Array.isArray(input?.labels) ? input.labels.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim()) : [];
  const workOnLabel = readWorkOnLabelFromAssignmentConfig(connection.assignmentConfig);
  const labels = Array.from(new Set([...requestedLabels, workOnLabel]));

  if (!summary || !projectKey || (!itemTypeId && !itemType)) {
    throw new Error("workgraph_create_item requires summary, projectKey (or configured workgraph projectKey), and itemTypeId/itemType. Call workgraph_list_fields first when field mapping is uncertain.");
  }

  assertLabelsAllowedForLoop(labels, connection.assignmentConfig);

  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    issuetype: itemTypeId ? { id: itemTypeId } : { name: itemType },
    summary,
  };

  if (description.length > 0) {
    fields.description = toJiraRichTextDocument(description);
  }

  if (parentKey.length > 0 || parentId.length > 0) {
    fields.parent = parentId.length > 0 ? { id: parentId } : { key: parentKey };
  }

  fields.labels = labels;

  const fieldUpdates = Array.isArray(input?.fieldUpdates)
    ? input.fieldUpdates
        .filter((entry): entry is Record<string, unknown> => isRecord(entry))
        .map((entry) => {
          const fieldId = typeof entry.fieldId === "string" ? entry.fieldId.trim() : "";
          return {
            fieldId,
            value: entry.value,
          };
        })
        .filter((entry) => entry.fieldId.length > 0 && typeof entry.value !== "undefined")
    : [];

  for (const update of fieldUpdates) {
    if (update.fieldId in fields) {
      continue;
    }

    fields[update.fieldId] = update.value;
  }

  const additionalFields = isRecord(input?.fields) ? input.fields : undefined;

  if (additionalFields) {
    for (const [fieldKey, fieldValue] of Object.entries(additionalFields)) {
      if (fieldKey in fields) {
        continue;
      }

      fields[fieldKey] = fieldValue;
    }
  }

  const response = await fetchJira(
    connection,
    {
      path: "/rest/api/3/issue",
      method: "POST",
      jsonBody: { fields },
    },
    {
      maxAttempts: 3,
      baseDelayMs: 600,
      maxDelayMs: 8_000,
      allowRetryOnNonIdempotentMethods: true,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`workgraph_create_item failed (${response.status}): ${detail || response.statusText}`);
  }

  const payload = (await response.json().catch(() => null)) as { id?: unknown; key?: unknown; self?: unknown } | null;
  const sourceItemKey = typeof payload?.key === "string" ? payload.key : null;
  const sourceItemId = typeof payload?.id === "string" ? payload.id : null;

  await synchronizeLoopWorkgraphAndPromoteTasks(context.loopId, connection.workgraph);

  const currentItems = await queryLoopWorkgraphItemList(context.loopId, connection.workgraph);
  const createdItem = sourceItemKey ? currentItems.find((item) => item.itemKey === sourceItemKey) : undefined;

  return {
    created: true,
    workgraph: connection.workgraph,
    item: createdItem?.id ?? null,
    sourceItemId,
    sourceItemKey,
    self: typeof payload?.self === "string" ? payload.self : null,
  };
};

export const executeWorkgraphReadItem = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const { workgraphId, item } = await resolveWorkgraphItemForInput(context.loopId, input, "workgraph and item are required for workgraph_read_item.");

  return {
    workgraph: workgraphId,
    item,
  };
};

export const executeWorkgraphAssignTaskItem = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const { workgraphId, item } = await resolveWorkgraphItemForInput(context.loopId, input, "workgraph and item are required for workgraph_assign_task_item.");
  const assigned = await queryTaskAssignWorkgraphItem(context.loopId, context.taskId, item.id, item.title ?? null);

  if (!assigned) {
    throw new Error("Unable to assign task to the selected workgraph item.");
  }

  return {
    assigned: true,
    task: context.taskId,
    workgraph: workgraphId,
    item: item.id,
    itemType: item.itemType,
    title: item.title,
  };
};

export const executeWorkgraphSearchItems = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const workgraphId = resolveWorkgraphId(input, "workgraph is required for workgraph_search_items.");
  const query = typeof input?.query === "string" ? input.query.trim().toLowerCase() : "";
  const maxResults = Math.max(1, Math.min(parseInteger(input?.maxResults, 50), 100));
  const items = await queryLoopWorkgraphItemList(context.loopId, workgraphId);
  const filtered =
    query.length > 0
      ? items.filter((item) => {
          return itemMatchesSearchQuery(item, query, new WeakSet<object>());
        })
      : items;

  return {
    workgraph: workgraphId,
    query: query.length > 0 ? query : null,
    total: filtered.length,
    items: filtered.slice(0, maxResults),
  };
};

export const executeWorkgraphAddLabels = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const { workgraphId, item } = await resolveWorkgraphItemForInput(context.loopId, input, "workgraph, item, and labels are required for workgraph_add_labels.");
  const labels = Array.isArray(input?.labels) ? input.labels.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim()) : [];

  if (labels.length === 0) {
    throw new Error("workgraph, item, and labels are required for workgraph_add_labels.");
  }

  if (!item.itemKey) {
    throw new Error("Selected workgraph item cannot be modified because it has no source item key.");
  }

  const connection = await resolveWorkgraphConnectionForInput(context.loopId, input);
  assertLabelsAllowedForLoop(labels, connection.assignmentConfig);
  const response = await fetchJira(
    connection,
    {
      path: `/rest/api/3/issue/${encodeURIComponent(item.itemKey)}`,
      method: "PUT",
      jsonBody: {
        update: {
          labels: labels.map((label) => ({ add: label })),
        },
      },
    },
    {
      maxAttempts: 3,
      baseDelayMs: 600,
      maxDelayMs: 8_000,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`workgraph_add_labels failed (${response.status}): ${detail || response.statusText}`);
  }

  return { workgraph: workgraphId, item: item.id, sourceItemKey: item.itemKey, labelsAdded: labels };
};

export const executeWorkgraphRemoveLabels = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const { workgraphId, item } = await resolveWorkgraphItemForInput(context.loopId, input, "workgraph, item, and labels are required for workgraph_remove_labels.");
  const labels = Array.isArray(input?.labels) ? input.labels.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim()) : [];

  if (labels.length === 0) {
    throw new Error("workgraph, item, and labels are required for workgraph_remove_labels.");
  }

  if (!item.itemKey) {
    throw new Error("Selected workgraph item cannot be modified because it has no source item key.");
  }

  const connection = await resolveWorkgraphConnectionForInput(context.loopId, input);
  assertLabelsAllowedForLoop(labels, connection.assignmentConfig);
  const response = await fetchJira(
    connection,
    {
      path: `/rest/api/3/issue/${encodeURIComponent(item.itemKey)}`,
      method: "PUT",
      jsonBody: {
        update: {
          labels: labels.map((label) => ({ remove: label })),
        },
      },
    },
    {
      maxAttempts: 3,
      baseDelayMs: 600,
      maxDelayMs: 8_000,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`workgraph_remove_labels failed (${response.status}): ${detail || response.statusText}`);
  }

  return { workgraph: workgraphId, item: item.id, sourceItemKey: item.itemKey, labelsRemoved: labels };
};

export const executeWorkgraphListTransitions = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const { workgraphId, item } = await resolveWorkgraphItemForInput(context.loopId, input, "workgraph and item are required for workgraph_list_transitions.");

  if (!item.itemKey) {
    throw new Error("Selected workgraph item cannot be read for transitions because it has no source item key.");
  }

  const connection = await resolveWorkgraphConnectionForInput(context.loopId, input);
  const response = await fetchJira(connection, {
    path: `/rest/api/3/issue/${encodeURIComponent(item.itemKey)}/transitions`,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`workgraph_list_transitions failed (${response.status}): ${detail || response.statusText}`);
  }

  const payload = (await response.json().catch(() => null)) as { transitions?: unknown[] } | null;
  const transitions = Array.isArray(payload?.transitions) ? payload.transitions : [];

  const normalized = transitions
    .filter((transition): transition is Record<string, unknown> => Boolean(transition) && typeof transition === "object")
    .map((transition) => {
      const idRaw = transition.id;
      const labelRaw = transition.name;
      const toRaw = transition.to;
      const toStatusRaw = toRaw && typeof toRaw === "object" ? (toRaw as { name?: unknown }).name : null;

      const id = typeof idRaw === "string" ? idRaw.trim() : "";
      const label = typeof labelRaw === "string" ? labelRaw.trim() : "";
      const toStatus = typeof toStatusRaw === "string" && toStatusRaw.trim().length > 0 ? toStatusRaw.trim() : null;

      return { id, label, toStatus };
    })
    .filter((transition) => transition.id.length > 0 && transition.label.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    workgraph: workgraphId,
    item: item.id,
    sourceItemKey: item.itemKey,
    total: normalized.length,
    transitions: normalized,
  };
};

export const executeWorkgraphTransitionItem = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const { workgraphId, item } = await resolveWorkgraphItemForInput(context.loopId, input, "workgraph, item, and transitionId are required for workgraph_transition_item.");
  const transitionId = typeof input?.transitionId === "string" ? input.transitionId.trim() : "";

  if (!transitionId) {
    throw new Error("workgraph, item, and transitionId are required for workgraph_transition_item.");
  }

  if (!item.itemKey) {
    throw new Error("Selected workgraph item cannot be transitioned because it has no source item key.");
  }

  const connection = await resolveWorkgraphConnectionForInput(context.loopId, input);
  const response = await fetchJira(
    connection,
    {
      path: `/rest/api/3/issue/${encodeURIComponent(item.itemKey)}/transitions`,
      method: "POST",
      jsonBody: {
        transition: {
          id: transitionId,
        },
      },
    },
    {
      maxAttempts: 1,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`workgraph_transition_item failed (${response.status}): ${detail || response.statusText}`);
  }

  return { workgraph: workgraphId, item: item.id, sourceItemKey: item.itemKey, transitionId };
};

export const executeWorkgraphEditField = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const { workgraphId, item } = await resolveWorkgraphItemForInput(context.loopId, input, "workgraph, item, fieldId, and value are required for workgraph_edit_field.");
  const fieldId = typeof input?.fieldId === "string" ? input.fieldId.trim() : "";
  const value = typeof input?.value === "string" ? input.value : undefined;

  if (!fieldId || typeof value !== "string") {
    throw new Error("workgraph, item, fieldId, and value are required for workgraph_edit_field.");
  }

  if (!item.itemKey) {
    throw new Error("Selected workgraph item cannot be edited because it has no source item key.");
  }

  const connection = await resolveWorkgraphConnectionForInput(context.loopId, input);

  try {
    await updateJiraIssueFields({
      connection,
      issueRef: item.itemKey,
      operationName: "workgraph_edit_field",
      fields: {
        [fieldId]: toJiraRichTextDocument(value),
      },
    });

    return {
      workgraph: workgraphId,
      item: item.id,
      sourceItemKey: item.itemKey,
      fieldId,
      updated: true,
      contentFormatUsed: "richText",
    };
  } catch (error) {
    await updateJiraIssueFields({
      connection,
      issueRef: item.itemKey,
      operationName: "workgraph_edit_field",
      fields: {
        [fieldId]: value,
      },
    }).catch(() => {
      throw error;
    });

    return {
      workgraph: workgraphId,
      item: item.id,
      sourceItemKey: item.itemKey,
      fieldId,
      updated: true,
      contentFormatUsed: "plainText",
    };
  }
};

export const executeWorkgraphAddComment = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const { workgraphId, item } = await resolveWorkgraphItemForInput(context.loopId, input, "workgraph, item, and comment are required for workgraph_add_comment.");
  const comment = typeof input?.comment === "string" ? input.comment.trim() : "";

  if (!comment) {
    throw new Error("workgraph, item, and comment are required for workgraph_add_comment.");
  }

  if (!item.itemKey) {
    throw new Error("Selected workgraph item cannot be commented because it has no source item key.");
  }

  const connection = await resolveWorkgraphConnectionForInput(context.loopId, input);
  const response = await fetchJira(
    connection,
    {
      path: `/rest/api/3/issue/${encodeURIComponent(item.itemKey)}/comment`,
      method: "POST",
      jsonBody: {
        body: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: comment }],
            },
          ],
        },
      },
    },
    {
      maxAttempts: 1,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`workgraph_add_comment failed (${response.status}): ${detail || response.statusText}`);
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  return {
    workgraph: workgraphId,
    item: item.id,
    sourceItemKey: item.itemKey,
    commentAdded: true,
    comment: payload,
  };
};
