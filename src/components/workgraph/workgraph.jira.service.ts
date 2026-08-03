import type { WorkgraphConnectionTest } from "./workgraph.schema.js";

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, ``);

const readJiraErrorMessage = async (response: Response): Promise<string | undefined> => {
  const payload = (await response.json().catch(() => null)) as
    | {
        errorMessages?: string[];
        errors?: Record<string, string>;
        message?: string;
      }
    | null;

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

export const testJiraWorkgraphConnection = async (input: WorkgraphConnectionTest): Promise<void> => {
  const normalizedProjectKey = input.projectKey?.trim() || null;
  const endpoint = `${normalizeBaseUrl(input.baseUrl)}/rest/api/3/search/jql`;

  let response: Response;

  try {
    response = await fetch(endpoint, {
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
    });
  } catch{
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
