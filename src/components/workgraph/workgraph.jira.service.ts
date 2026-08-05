import type { WorkgraphConnectionTest } from "./workgraph.schema.js";
import { fetchWithRetry } from "@components/utilities/http-retry.js";

export type JiraIssueType = {
  id: string;
  name: string;
  hierarchyLevel: number | null;
};

export type JiraSyncedItem = {
  itemKey: string;
  itemId: string;
  parentKey: string | null;
  title: string;
  itemType: string;
  status: string | null;
  webUrl: string;
  payload: Record<string, unknown>;
};

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, ``);

const readJiraErrorMessage = async (response: Response): Promise<string | undefined> => {
  const payload = (await response.json().catch(() => null)) as {
    errorMessages?: string[];
    errors?: Record<string, string>;
    message?: string;
  } | null;

  if (!payload) {
    return undefined;
  }

  if (Array.isArray(payload.errorMessages) && payload.errorMessages.length > 0) {
    return payload.errorMessages[0];
  }

  if (payload.errors && typeof payload.errors === `object`) {
    const firstError = Object.values(payload.errors)[0];

    if (typeof firstError === `string` && firstError.trim().length > 0) {
      return firstError;
    }
  }

  if (typeof payload.message === `string` && payload.message.trim().length > 0) {
    return payload.message;
  }

  return undefined;
};

const issueKeyPattern = /^[A-Z][A-Z0-9_]+-\d+$/;

const extractIssueKey = (value: unknown): string | null => {
  if (typeof value === `string`) {
    const trimmed = value.trim();
    return issueKeyPattern.test(trimmed) ? trimmed : null;
  }

  if (value && typeof value === `object`) {
    const candidate = (value as { key?: unknown }).key;
    if (typeof candidate === `string` && issueKeyPattern.test(candidate.trim())) {
      return candidate.trim();
    }
  }

  return null;
};

const extractIssueId = (value: unknown): string | null => {
  if (typeof value === `string`) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === `number` && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const resolveIssueKey = (issue: { id?: unknown; key?: unknown; issueKey?: unknown; fields?: unknown }): string | null => {
  const directKey = extractIssueKey(issue.key);

  if (directKey) {
    return directKey;
  }

  const enhancedKey = extractIssueKey(issue.issueKey);

  if (enhancedKey) {
    return enhancedKey;
  }

  const fields = issue.fields && typeof issue.fields === `object` ? (issue.fields as Record<string, unknown>) : null;

  if (!fields) {
    return null;
  }

  const fieldsKey = extractIssueKey(fields.key);
  if (fieldsKey) {
    return fieldsKey;
  }

  const fieldsIssueKey = extractIssueKey(fields.issueKey);
  if (fieldsIssueKey) {
    return fieldsIssueKey;
  }

  return null;
};

const resolveIssueId = (issue: { id?: unknown; issueId?: unknown; fields?: unknown }): string | null => {
  const directId = extractIssueId(issue.id);

  if (directId) {
    return directId;
  }

  const enhancedId = extractIssueId(issue.issueId);

  if (enhancedId) {
    return enhancedId;
  }

  const fields = issue.fields && typeof issue.fields === `object` ? (issue.fields as Record<string, unknown>) : null;

  if (!fields) {
    return null;
  }

  const fieldsId = extractIssueId(fields.id);

  if (fieldsId) {
    return fieldsId;
  }

  return null;
};

const resolveParentKey = (fields: Record<string, unknown>): string | null => {
  const directParent = extractIssueKey(fields.parent);
  if (directParent) {
    return directParent;
  }

  const roadmapParent = extractIssueKey(fields.customfield_10018);
  if (roadmapParent) {
    return roadmapParent;
  }

  const epicParent = extractIssueKey(fields.customfield_10014);
  if (epicParent) {
    return epicParent;
  }

  return null;
};

const asIssuePayload = (issue: { id?: unknown; key?: unknown; fields?: unknown }): Record<string, unknown> => {
  const payload = issue as unknown;

  if (!payload || typeof payload !== `object` || Array.isArray(payload)) {
    return {};
  }

  return payload as Record<string, unknown>;
};

const toSyncedItem = (input: { browseBaseUrl: string }, issue: { id?: unknown; key?: unknown; fields?: unknown }): JiraSyncedItem | null => {
  const itemKey = resolveIssueKey(issue) ?? ``;
  const itemId = resolveIssueId(issue) ?? ``;

  if (!itemKey || !itemId) {
    return null;
  }

  const fields = issue.fields && typeof issue.fields === `object` ? (issue.fields as Record<string, unknown>) : {};
  const summary = typeof fields.summary === `string` && fields.summary.trim().length > 0 ? fields.summary.trim() : itemKey;
  const issueType = fields.issuetype && typeof fields.issuetype === `object` && typeof (fields.issuetype as { name?: unknown }).name === `string` ? String((fields.issuetype as { name: string }).name) : `Issue`;
  const status = fields.status && typeof fields.status === `object` && typeof (fields.status as { name?: unknown }).name === `string` ? String((fields.status as { name: string }).name) : null;
  const parentKey = resolveParentKey(fields);

  return {
    itemKey,
    itemId,
    parentKey,
    title: summary,
    itemType: issueType,
    status,
    webUrl: `${normalizeBaseUrl(input.browseBaseUrl)}/browse/${itemKey}`,
    payload: asIssuePayload(issue),
  };
};

type JiraSearchPayload = {
  issues?: Array<{ id?: unknown; key?: unknown; issueId?: unknown; issueKey?: unknown; fields?: unknown }>;
  startAt?: number;
  maxResults?: number;
  total?: number;
  nextPageToken?: string;
  isLast?: boolean;
};

const fetchJiraSearchPage = async (input: { baseUrl: string; email: string; apiKey: string; jql: string; maxResults: number; nextPageToken?: string }): Promise<JiraSearchPayload> => {
  const endpoint = `${normalizeBaseUrl(input.baseUrl)}/rest/api/3/search/jql`;

  let response: Response;

  try {
    response = await fetchWithRetry(endpoint, {
      method: `POST`,
      headers: {
        Accept: `application/json`,
        "Content-Type": `application/json`,
        Authorization: `Basic ${Buffer.from(`${input.email}:${input.apiKey}`, `utf8`).toString(`base64`)}`,
      },
      body: JSON.stringify({
        jql: input.jql,
        maxResults: input.maxResults,
        nextPageToken: input.nextPageToken,
        fields: [`*all`],
      }),
    }, {
      maxAttempts: 4,
      baseDelayMs: 600,
      maxDelayMs: 8_000,
      allowRetryOnNonIdempotentMethods: true,
    });
  } catch {
    throw new Error(`Unable to reach Jira. Verify the base URL and network connectivity.`);
  }

  if (!response.ok) {
    const details = await readJiraErrorMessage(response);

    if (response.status === 401 || response.status === 403) {
      throw new Error(details ?? `Jira authentication failed. Verify the API key and permissions.`);
    }

    throw new Error(details ?? `Jira sync failed with status ${response.status}.`);
  }

  const payload = (await response.json().catch(() => null)) as JiraSearchPayload | null;

  if (!payload || !Array.isArray(payload.issues)) {
    throw new Error(`Jira returned an invalid search payload.`);
  }

  return payload;
};

export const testJiraWorkgraphConnection = async (input: WorkgraphConnectionTest): Promise<void> => {
  const normalizedProjectKey = input.projectKey?.trim() || null;
  const endpoint = `${normalizeBaseUrl(input.baseUrl)}/rest/api/3/search/jql`;

  let response: Response;

  try {
    response = await fetchWithRetry(endpoint, {
      method: `POST`,
      headers: {
        Accept: `application/json`,
        "Content-Type": `application/json`,
        Authorization: `Basic ${Buffer.from(`${input.email}:${input.apiKey}`, `utf8`).toString(`base64`)}`,
      },
      body: JSON.stringify({
        jql: normalizedProjectKey ? `project=${normalizedProjectKey}` : ``,
        maxResults: 1,
        fields: [`id`],
      }),
    }, {
      maxAttempts: 4,
      baseDelayMs: 600,
      maxDelayMs: 8_000,
      allowRetryOnNonIdempotentMethods: true,
    });
  } catch {
    throw new Error(`Unable to reach Jira. Verify the base URL and network connectivity.`);
  }

  if (response.ok) {
    return;
  }

  const details = await readJiraErrorMessage(response);

  if (response.status === 401 || response.status === 403) {
    throw new Error(details ?? `Jira authentication failed. Verify the API key and permissions.`);
  }

  if (response.status === 404 && normalizedProjectKey) {
    throw new Error(details ?? `Project key "${normalizedProjectKey}" was not found in Jira.`);
  }

  throw new Error(details ?? `Jira connection test failed with status ${response.status}.`);
};

export const syncJiraWorkgraphItems = async (input: { baseUrl: string; browseBaseUrl: string; email: string; apiKey: string; jql: string }): Promise<JiraSyncedItem[]> => {
  const jql = input.jql.trim();

  if (jql.length === 0) {
    return [];
  }

  const maxResults = 100;
  let nextPageToken: string | undefined;
  const byKey = new Map<string, JiraSyncedItem>();

  while (true) {
    const page = await fetchJiraSearchPage({
      baseUrl: input.baseUrl,
      email: input.email,
      apiKey: input.apiKey,
      jql,
      maxResults,
      nextPageToken,
    });

    const issues = page.issues ?? [];

    for (const issue of issues) {
      const mapped = toSyncedItem({ browseBaseUrl: input.browseBaseUrl }, issue);
      if (mapped) {
        byKey.set(mapped.itemKey, mapped);
      }
    }

    if (typeof page.nextPageToken !== `string` || page.nextPageToken.trim().length === 0) {
      break;
    }

    nextPageToken = page.nextPageToken.trim();
  }

  return Array.from(byKey.values());
};

const fetchJiraIssueTypes = async (input: { baseUrl: string; email: string; apiKey: string; projectKey?: string | null }): Promise<unknown> => {
  const normalizedBaseUrl = normalizeBaseUrl(input.baseUrl);
  const normalizedProjectKey = input.projectKey?.trim() || null;
  const endpoint = normalizedProjectKey ? `${normalizedBaseUrl}/rest/api/3/project/${encodeURIComponent(normalizedProjectKey)}` : `${normalizedBaseUrl}/rest/api/3/issuetype`;

  let response: Response;

  try {
    response = await fetchWithRetry(endpoint, {
      method: `GET`,
      headers: {
        Accept: `application/json`,
        Authorization: `Basic ${Buffer.from(`${input.email}:${input.apiKey}`, `utf8`).toString(`base64`)}`,
      },
    }, {
      maxAttempts: 4,
      baseDelayMs: 500,
      maxDelayMs: 8_000,
    });
  } catch {
    throw new Error(`Unable to reach Jira. Verify the base URL and network connectivity.`);
  }

  if (!response.ok) {
    const details = await readJiraErrorMessage(response);

    if (response.status === 401 || response.status === 403) {
      throw new Error(details ?? `Jira authentication failed. Verify the API key and permissions.`);
    }

    if (response.status === 404 && normalizedProjectKey) {
      throw new Error(details ?? `Project key "${normalizedProjectKey}" was not found in Jira.`);
    }

    throw new Error(details ?? `Jira issue type request failed with status ${response.status}.`);
  }

  return response.json().catch(() => null);
};

export const listJiraIssueTypes = async (input: { baseUrl: string; email: string; apiKey: string; projectKey?: string | null }): Promise<JiraIssueType[]> => {
  const payload = await fetchJiraIssueTypes(input);

  const issueTypes = Array.isArray(payload) ? payload : payload && typeof payload === `object` && Array.isArray((payload as { issueTypes?: unknown[] }).issueTypes) ? (payload as { issueTypes: unknown[] }).issueTypes : [];

  const byId = new Map<string, JiraIssueType>();

  for (const issueType of issueTypes) {
    if (!issueType || typeof issueType !== `object`) {
      continue;
    }

    const idRaw = (issueType as { id?: unknown }).id;
    const nameRaw = (issueType as { name?: unknown }).name;
    const hierarchyLevelRaw = (issueType as { hierarchyLevel?: unknown }).hierarchyLevel;
    const id = typeof idRaw === `string` ? idRaw.trim() : ``;
    const name = typeof nameRaw === `string` ? nameRaw.trim() : ``;
    const hierarchyLevel = typeof hierarchyLevelRaw === `number` && Number.isFinite(hierarchyLevelRaw) ? hierarchyLevelRaw : null;

    if (!id || !name) {
      continue;
    }

    byId.set(id, { id, name, hierarchyLevel });
  }

  const hierarchyNamePriority: Record<string, number> = {
    objective: 500,
    initiative: 450,
    epic: 400,
    story: 300,
    task: 250,
    bug: 240,
    subtask: 100,
    "sub-task": 100,
  };

  const normalizeTypeName = (value: string) => value.toLowerCase().replace(/\s+/g, ``);

  const fallbackPriority = (issueTypeName: string): number => hierarchyNamePriority[normalizeTypeName(issueTypeName)] ?? 0;

  const sortedIssueTypes = Array.from(byId.values()).sort((a, b) => {
    const aHierarchy = a.hierarchyLevel;
    const bHierarchy = b.hierarchyLevel;

    if (aHierarchy !== null || bHierarchy !== null) {
      const aValue = aHierarchy ?? Number.NEGATIVE_INFINITY;
      const bValue = bHierarchy ?? Number.NEGATIVE_INFINITY;

      if (aValue !== bValue) {
        return bValue - aValue;
      }
    }

    const aFallback = fallbackPriority(a.name);
    const bFallback = fallbackPriority(b.name);

    if (aFallback !== bFallback) {
      return bFallback - aFallback;
    }

    return a.name.localeCompare(b.name);
  });

  return sortedIssueTypes;
};
