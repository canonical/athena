import { queryLoopWorkgraphList, queryLoopWorkgraphSyncConnection } from "@components/workgraph/workgraph.pg.service.js";
import { syncJiraWorkgraphItems } from "@components/workgraph/workgraph.jira.service.js";
import { readWorkDoneLabelFromAssignmentConfig, readWorkInProgressLabelFromAssignmentConfig, readWorkOnLabelFromAssignmentConfig } from "@components/workgraph/workgraph.assignment-config.js";
import { fetchWithRetry } from "@components/utilities/http-retry.js";
import type { ProviderToolExecutionContext } from "./tool.schema.js";

const makeJiraBasicAuthHeader = (email: string, apiKey: string): string => {
  const token = Buffer.from(`${email}:${apiKey}`).toString("base64");
  return `Basic ${token}`;
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

export const executeJiraReadIssue = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const issueKey = typeof input?.issueKey === "string" ? input.issueKey.trim() : "";
  const issueId = typeof input?.issueId === "string" ? input.issueId.trim() : "";
  const issueRef = issueKey || issueId;

  if (!issueRef) {
    throw new Error("issueKey or issueId is required for jira_read_issue.");
  }

  const connection = await resolveJiraConnectionForLoop(context.loopId);
  const response = await fetchWithRetry(`${connection.baseUrl.replace(/\/+$/u, "")}/rest/api/3/issue/${encodeURIComponent(issueRef)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: makeJiraBasicAuthHeader(connection.email, connection.apiKey),
    },
  }, {
    maxAttempts: 4,
    baseDelayMs: 500,
    maxDelayMs: 8_000,
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
  const response = await fetchWithRetry(`${connection.baseUrl.replace(/\/+$/u, "")}/rest/api/3/issue/${encodeURIComponent(issueRef)}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: makeJiraBasicAuthHeader(connection.email, connection.apiKey),
    },
    body: JSON.stringify({
      update: {
        labels: labels.map((label) => ({ add: label })),
      },
    }),
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
  const response = await fetchWithRetry(`${connection.baseUrl.replace(/\/+$/u, "")}/rest/api/3/issue/${encodeURIComponent(issueRef)}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: makeJiraBasicAuthHeader(connection.email, connection.apiKey),
    },
    body: JSON.stringify({
      update: {
        labels: labels.map((label) => ({ remove: label })),
      },
    }),
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

export const executeJiraTransitionIssue = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const issueRef = typeof input?.issueKey === "string" && input.issueKey.trim().length > 0 ? input.issueKey.trim() : typeof input?.issueId === "string" ? input.issueId.trim() : "";
  const transitionId = typeof input?.transitionId === "string" ? input.transitionId.trim() : "";

  if (!issueRef || !transitionId) {
    throw new Error("issueKey/issueId and transitionId are required for jira_transition_issue.");
  }

  const connection = await resolveJiraConnectionForLoop(context.loopId);
  const response = await fetchWithRetry(`${connection.baseUrl.replace(/\/+$/u, "")}/rest/api/3/issue/${encodeURIComponent(issueRef)}/transitions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: makeJiraBasicAuthHeader(connection.email, connection.apiKey),
    },
    body: JSON.stringify({
      transition: {
        id: transitionId,
      },
    }),
  }, {
    maxAttempts: 1,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`jira_transition_issue failed (${response.status}): ${detail || response.statusText}`);
  }

  return { issue: issueRef, transitionId };
};

export const executeJiraAddComment = async (context: ProviderToolExecutionContext, input: Record<string, unknown> | undefined): Promise<unknown> => {
  const issueRef = typeof input?.issueKey === "string" && input.issueKey.trim().length > 0 ? input.issueKey.trim() : typeof input?.issueId === "string" ? input.issueId.trim() : "";
  const comment = typeof input?.comment === "string" ? input.comment.trim() : "";

  if (!issueRef || !comment) {
    throw new Error("issueKey/issueId and comment are required for jira_add_comment.");
  }

  const connection = await resolveJiraConnectionForLoop(context.loopId);
  const response = await fetchWithRetry(`${connection.baseUrl.replace(/\/+$/u, "")}/rest/api/3/issue/${encodeURIComponent(issueRef)}/comment`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: makeJiraBasicAuthHeader(connection.email, connection.apiKey),
    },
    body: JSON.stringify({
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
    }),
  }, {
    maxAttempts: 1,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`jira_add_comment failed (${response.status}): ${detail || response.statusText}`);
  }

  return (await response.json().catch(() => ({ issue: issueRef, commentAdded: true }))) as unknown;
};
