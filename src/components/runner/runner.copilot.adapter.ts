import { CopilotAgentTaskIdMissingError } from "./runner.errors.js";

const GITHUB_API_VERSION = `2026-03-10`;
const GITHUB_API_BASE = `https://api.github.com`;

// Interval and limit for polling a submitted agent task.
const POLL_INTERVAL_MS = 15_000;
const POLL_MAX_ATTEMPTS = 40; // 40 × 15 s = 10 minutes max

type CopilotTaskState = `queued` | `in_progress` | `completed` | `failed` | `idle` | `waiting_for_user` | `timed_out` | `cancelled`;

type CopilotTaskArtifact = {
  provider: `github`;
  type: `pull` | `branch`;
  data: { id: number; global_id?: string } | { head_ref: string; base_ref: string };
};

export type CopilotAgentTask = {
  id: string;
  url?: string;
  html_url?: string;
  name?: string;
  state: CopilotTaskState;
  artifacts?: CopilotTaskArtifact[];
  created_at: string;
  updated_at?: string;
  [key: string]: unknown;
};

type CopilotTaskListResponse = {
  tasks: CopilotAgentTask[];
  total_active_count?: number;
  total_archived_count?: number;
};

const githubHeaders = (apiKey: string): Record<string, string> => ({
  Accept: `application/vnd.github+json`,
  Authorization: `Bearer ${apiKey}`,
  "X-GitHub-Api-Version": GITHUB_API_VERSION,
  "Content-Type": `application/json`,
});

export const listCopilotAgentTasks = async (apiKey: string, repository: string): Promise<CopilotAgentTask[]> => {
  const url = `${GITHUB_API_BASE}/agents/repos/${repository}/tasks`;

  console.log(`[copilot-adapter] listing agent tasks`, { repository, url });

  const response = await fetch(url, { headers: githubHeaders(apiKey) });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub agent task list failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as CopilotTaskListResponse;

  console.log(`[copilot-adapter] tasks listed`, { repository, count: data.tasks.length });
  return data.tasks;
};

export const submitCopilotAgentTask = async (apiKey: string, repository: string, prompt: string): Promise<{ externalTaskId: string }> => {
  const url = `${GITHUB_API_BASE}/agents/repos/${repository}/tasks`;

  console.log(`[copilot-adapter] submitting agent task`, { repository, url });

  const response = await fetch(url, {
    method: `POST`,
    headers: githubHeaders(apiKey),
    body: JSON.stringify({ prompt, create_pull_request: true, base_ref: `main` }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub agent task submission failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as CopilotAgentTask;
  const externalTaskId = typeof data.id === `string` ? data.id.trim() : ``;

  if (!externalTaskId) {
    throw new CopilotAgentTaskIdMissingError();
  }

  console.log(`[copilot-adapter] agent task submitted`, { repository, externalTaskId, state: data.state });
  return { externalTaskId };
};

export const pollCopilotAgentTask = async (apiKey: string, repository: string, externalTaskId: string): Promise<{ done: boolean; succeeded: boolean; result: string }> => {
  const url = `${GITHUB_API_BASE}/agents/repos/${repository}/tasks/${externalTaskId}`;

  console.log(`[copilot-adapter] polling agent task`, { repository, externalTaskId });

  const response = await fetch(url, { headers: githubHeaders(apiKey) });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub agent task poll failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as CopilotAgentTask;

  console.log(`[copilot-adapter] poll response`, { repository, externalTaskId, state: data.state });

  const terminal: CopilotTaskState[] = [`completed`, `failed`, `timed_out`, `cancelled`];

  if (!terminal.includes(data.state)) {
    return { done: false, succeeded: false, result: `` };
  }

  const succeeded = data.state === `completed`;
  const pullArtifact = data.artifacts?.find((a) => a.type === `pull`);
  const result = JSON.stringify({
    state: data.state,
    htmlUrl: data.html_url ?? null,
    pullRequestId: pullArtifact && `id` in pullArtifact.data ? pullArtifact.data.id : null,
  });

  return { done: true, succeeded, result };
};

export const runCopilotAgentTaskWithPolling = async (apiKey: string, repository: string, externalTaskId: string): Promise<{ succeeded: boolean; result: string }> => {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const { done, succeeded, result } = await pollCopilotAgentTask(apiKey, repository, externalTaskId);

    if (done) {
      return { succeeded, result };
    }
  }

  return {
    succeeded: false,
    result: JSON.stringify({ state: `timeout`, error: `Polling exceeded max attempts (${POLL_MAX_ATTEMPTS})` }),
  };
};
