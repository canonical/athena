import { queryLoopWorkgraphList, queryLoopWorkgraphSyncConnection } from "@components/workgraph/workgraph.pg.service.js";
import { syncJiraWorkgraphItems } from "@components/workgraph/workgraph.jira.service.js";
import { readWorkDoneLabelFromAssignmentConfig, readWorkInProgressLabelFromAssignmentConfig, readWorkOnLabelFromAssignmentConfig } from "@components/workgraph/workgraph.assignment-config.js";
import { fetchWithRetry } from "@components/utilities/http-retry.js";
import type { ProviderToolExecutionContext } from "./tool.schema.js";

const makeJiraBasicAuthHeader = (email: string, apiKey: string): string => {
  const token = Buffer.from(`${email}:${apiKey}`).toString("base64");
  return `Basic ${token}`;
};

type JiraConnection = Awaited<ReturnType<typeof resolveJiraConnectionForLoop>>;

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

const buildJiraApiUrl = (connection: JiraConnection, path: string): string => {
  return `${connection.baseUrl.replace(/\/+$/u, "")}${path}`;
};

const fetchJira = async (
  connection: JiraConnection,
  input: JiraFetchInput,
  retryOptions?: JiraFetchRetryOptions,
): Promise<Response> => {
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

const resolveJiraConnectionForLoop = async (loopId: string) => {
  const loopWorkgraphs = await queryLoopWorkgraphList(loopId);
  const enabledJira = loopWorkgraphs.find((item) => item.enabled && item.type === "jira");

  if (!enabledJira) {
    throw new Error("No enabled Jira workgraph assignment is available for this loop.");
  }

  const connection = await queryLoopWorkgraphSyncConnection(loopId, enabledJira.workgraph);

  if (!connection) {
    throw new Error("Jira connection metadata not found for the selected workgraph.");
  }

  return connection;
};

const readAllowedLoopLabels = (assignmentConfig: unknown): string[] => {
  const labels = [
    readWorkOnLabelFromAssignmentConfig(assignmentConfig),
    readWorkInProgressLabelFromAssignmentConfig(assignmentConfig),
    readWorkDoneLabelFromAssignmentConfig(assignmentConfig),
  ];

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

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

const updateJiraIssueFields = async (input: {
  connection: JiraConnection;
  issueRef: string;
  fields: Record<string, unknown>;
  operationName: string;
}): Promise<void> => {
  const response = await fetchJira(input.connection, {
    path: `/rest/api/3/issue/${encodeURIComponent(input.issueRef)}`,
    method: "PUT",
    jsonBody: { fields: input.fields },
  }, {
    maxAttempts: 3,
    baseDelayMs: 600,
    maxDelayMs: 8_000,
    allowRetryOnNonIdempotentMethods: true,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${input.operationName} failed (${response.status}): ${detail || response.statusText}`);
  }
};

export const executeJiraFieldList = async (context: ProviderToolExecutionContext): Promise<unknown> => {
  const connection = await resolveJiraConnectionForLoop(context.loopId);
  const response = await fetchJira(connection, { path: "/rest/api/3/field" });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`jira_field_list failed (${response.status}): ${detail || response.statusText}`);
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
      const schema = field.schema && typeof field.schema === "object" ? field.schema as Record<string, unknown> : undefined;
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
    total: normalized.length,
    fields: normalized,
  };
};

export const executeJiraCreateIssue = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const connection = await resolveJiraConnectionForLoop(context.loopId);
  const summary = typeof input?.summary === "string" ? input.summary.trim() : "";
  const issueTypeId = typeof input?.issueTypeId === "string" ? input.issueTypeId.trim() : "";
  const issueType = typeof input?.issueType === "string" ? input.issueType.trim() : "";
  const explicitProjectKey = typeof input?.projectKey === "string" ? input.projectKey.trim() : "";
  const projectKey = explicitProjectKey || connection.projectKey?.trim() || "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  const parentKey = typeof input?.parentKey === "string" ? input.parentKey.trim() : "";
  const parentId = typeof input?.parentId === "string" ? input.parentId.trim() : "";
  const labels = Array.isArray(input?.labels)
    ? input.labels.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim())
    : [];

  if (!summary || !projectKey || (!issueTypeId && !issueType)) {
    throw new Error("jira_create_issue requires summary, projectKey (or configured workgraph projectKey), and issueTypeId/issueType. Call jira_field_list first when field mapping is uncertain.");
  }

  if (labels.length > 0) {
    assertLabelsAllowedForLoop(labels, connection.assignmentConfig);
  }

  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    issuetype: issueTypeId ? { id: issueTypeId } : { name: issueType },
    summary,
  };

  if (description.length > 0) {
    fields.description = toJiraRichTextDocument(description);
  }

  if (parentKey.length > 0 || parentId.length > 0) {
    fields.parent = parentId.length > 0 ? { id: parentId } : { key: parentKey };
  }

  if (labels.length > 0) {
    fields.labels = labels;
  }

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

  const response = await fetchJira(connection, {
    path: "/rest/api/3/issue",
    method: "POST",
    jsonBody: { fields },
  }, {
    maxAttempts: 3,
    baseDelayMs: 600,
    maxDelayMs: 8_000,
    allowRetryOnNonIdempotentMethods: true,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`jira_create_issue failed (${response.status}): ${detail || response.statusText}`);
  }

  const payload = (await response.json().catch(() => null)) as { id?: unknown; key?: unknown; self?: unknown } | null;

  return {
    created: true,
    issueId: typeof payload?.id === "string" ? payload.id : null,
    issueKey: typeof payload?.key === "string" ? payload.key : null,
    self: typeof payload?.self === "string" ? payload.self : null,
  };
};

export const executeJiraReadIssue = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const issueKey = typeof input?.issueKey === "string" ? input.issueKey.trim() : "";
  const issueId = typeof input?.issueId === "string" ? input.issueId.trim() : "";
  const issueRef = issueKey || issueId;

  if (!issueRef) {
    throw new Error("issueKey or issueId is required for jira_read_issue.");
  }

  const connection = await resolveJiraConnectionForLoop(context.loopId);
  const response = await fetchJira(connection, {
    path: `/rest/api/3/issue/${encodeURIComponent(issueRef)}`,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`jira_read_issue failed (${response.status}): ${detail || response.statusText}`);
  }

  return (await response.json()) as unknown;
};

export const executeJiraSearch = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const connection = await resolveJiraConnectionForLoop(context.loopId);
  const jql = typeof input?.jql === "string" && input.jql.trim().length > 0 ? input.jql.trim() : "project is not empty ORDER BY updated DESC";
  const maxResults = Math.max(1, Math.min(parseInteger(input?.maxResults, 50), 100));

  const items = await syncJiraWorkgraphItems({
    baseUrl: connection.baseUrl,
    browseBaseUrl: connection.browseBaseUrl ?? connection.baseUrl,
    email: connection.email,
    apiKey: connection.apiKey,
    jql,
  });

  return {
    jql,
    total: items.length,
    items: items.slice(0, maxResults),
  };
};

export const executeJiraAddLabels = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const issueRef = typeof input?.issueKey === "string" && input.issueKey.trim().length > 0 ? input.issueKey.trim() : typeof input?.issueId === "string" ? input.issueId.trim() : "";
  const labels = Array.isArray(input?.labels) ? input.labels.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim()) : [];

  if (!issueRef || labels.length === 0) {
    throw new Error("issueKey/issueId and labels are required for jira_add_labels.");
  }

  const connection = await resolveJiraConnectionForLoop(context.loopId);
  assertLabelsAllowedForLoop(labels, connection.assignmentConfig);
  const response = await fetchJira(connection, {
    path: `/rest/api/3/issue/${encodeURIComponent(issueRef)}`,
    method: "PUT",
    jsonBody: {
      update: {
        labels: labels.map((label) => ({ add: label })),
      },
    },
  }, {
    maxAttempts: 3,
    baseDelayMs: 600,
    maxDelayMs: 8_000,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`jira_add_labels failed (${response.status}): ${detail || response.statusText}`);
  }

  return { issue: issueRef, labelsAdded: labels };
};

export const executeJiraRemoveLabels = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const issueRef = typeof input?.issueKey === "string" && input.issueKey.trim().length > 0 ? input.issueKey.trim() : typeof input?.issueId === "string" ? input.issueId.trim() : "";
  const labels = Array.isArray(input?.labels) ? input.labels.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim()) : [];

  if (!issueRef || labels.length === 0) {
    throw new Error("issueKey/issueId and labels are required for jira_remove_labels.");
  }

  const connection = await resolveJiraConnectionForLoop(context.loopId);
  assertLabelsAllowedForLoop(labels, connection.assignmentConfig);
  const response = await fetchJira(connection, {
    path: `/rest/api/3/issue/${encodeURIComponent(issueRef)}`,
    method: "PUT",
    jsonBody: {
      update: {
        labels: labels.map((label) => ({ remove: label })),
      },
    },
  }, {
    maxAttempts: 3,
    baseDelayMs: 600,
    maxDelayMs: 8_000,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`jira_remove_labels failed (${response.status}): ${detail || response.statusText}`);
  }

  return { issue: issueRef, labelsRemoved: labels };
};

export const executeJiraTransitionList = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const issueRef = typeof input?.issueKey === "string" && input.issueKey.trim().length > 0 ? input.issueKey.trim() : typeof input?.issueId === "string" ? input.issueId.trim() : "";

  if (!issueRef) {
    throw new Error("issueKey or issueId is required for jira_transition_list.");
  }

  const connection = await resolveJiraConnectionForLoop(context.loopId);
  const response = await fetchJira(connection, {
    path: `/rest/api/3/issue/${encodeURIComponent(issueRef)}/transitions`,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`jira_transition_list failed (${response.status}): ${detail || response.statusText}`);
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
    issue: issueRef,
    total: normalized.length,
    transitions: normalized,
  };
};

export const executeJiraTransitionIssue = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const issueRef = typeof input?.issueKey === "string" && input.issueKey.trim().length > 0 ? input.issueKey.trim() : typeof input?.issueId === "string" ? input.issueId.trim() : "";
  const transitionId = typeof input?.transitionId === "string" ? input.transitionId.trim() : "";

  if (!issueRef || !transitionId) {
    throw new Error("issueKey/issueId and transitionId are required for jira_transition_issue.");
  }

  const connection = await resolveJiraConnectionForLoop(context.loopId);
  const response = await fetchJira(connection, {
    path: `/rest/api/3/issue/${encodeURIComponent(issueRef)}/transitions`,
    method: "POST",
    jsonBody: {
      transition: {
        id: transitionId,
      },
    },
  }, {
    maxAttempts: 1,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`jira_transition_issue failed (${response.status}): ${detail || response.statusText}`);
  }

  return { issue: issueRef, transitionId };
};

export const executeJiraEditField = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const issueRef = typeof input?.issueKey === "string" && input.issueKey.trim().length > 0 ? input.issueKey.trim() : typeof input?.issueId === "string" ? input.issueId.trim() : "";
  const fieldId = typeof input?.fieldId === "string" ? input.fieldId.trim() : "";
  const value = typeof input?.value === "string" ? input.value : undefined;

  if (!issueRef || !fieldId || typeof value !== "string") {
    throw new Error("issueKey/issueId, fieldId, and value are required for jira_edit_field.");
  }

  const connection = await resolveJiraConnectionForLoop(context.loopId);

  try {
    await updateJiraIssueFields({
      connection,
      issueRef,
      operationName: "jira_edit_field",
      fields: {
        [fieldId]: toJiraRichTextDocument(value),
      },
    });

    return {
      issue: issueRef,
      fieldId,
      updated: true,
      contentFormatUsed: "richText",
    };
  } catch (error) {
    await updateJiraIssueFields({
      connection,
      issueRef,
      operationName: "jira_edit_field",
      fields: {
        [fieldId]: value,
      },
    }).catch(() => {
      throw error;
    });

    return {
      issue: issueRef,
      fieldId,
      updated: true,
      contentFormatUsed: "plainText",
    };
  }
};

export const executeJiraAddComment = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const issueRef = typeof input?.issueKey === "string" && input.issueKey.trim().length > 0 ? input.issueKey.trim() : typeof input?.issueId === "string" ? input.issueId.trim() : "";
  const comment = typeof input?.comment === "string" ? input.comment.trim() : "";

  if (!issueRef || !comment) {
    throw new Error("issueKey/issueId and comment are required for jira_add_comment.");
  }

  const connection = await resolveJiraConnectionForLoop(context.loopId);
  const response = await fetchJira(connection, {
    path: `/rest/api/3/issue/${encodeURIComponent(issueRef)}/comment`,
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
  }, {
    maxAttempts: 1,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`jira_add_comment failed (${response.status}): ${detail || response.statusText}`);
  }

  return (await response.json().catch(() => ({ issue: issueRef, commentAdded: true }))) as unknown;
};
