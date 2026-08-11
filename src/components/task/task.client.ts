import { authenticatedJsonGet, authenticatedJsonPost } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import type { Task, TaskCreate } from "./task.schema.js";

export const taskApiPaths = {
  list: (loopId: string) => getApiUrl(`/task/loop/${loopId}`),
  detail: (loopId: string, taskId: string) => getApiUrl(`/task/loop/${loopId}/${taskId}`),
  create: () => getApiUrl(`/task/`),
  appendUserMessage: () => getApiUrl(`/task/append-user-message`),
  approveToolCall: () => getApiUrl(`/task/approve-tool-call`),
  rejectToolCall: () => getApiUrl(`/task/reject-tool-call`),
  updateTitle: () => getApiUrl(`/task/update-title`),
  updateObjective: () => getApiUrl(`/task/update-objective`),
  assignWorkgraphItem: () => getApiUrl(`/task/assign-workgraph-item`),
  assignedWorkgraphItem: (loopId: string, taskId: string) => getApiUrl(`/task/loop/${loopId}/${taskId}/workgraph-item`),
} as const;

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const fetchTasks = async (loopId: string): Promise<Task[]> => {
  const response = await authenticatedJsonGet(taskApiPaths.list(loopId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Tasks request failed with status ${response.status}`));
  }

  return response.json() as Promise<Task[]>;
};

export const fetchTask = async (loopId: string, taskId: string): Promise<Task> => {
  const response = await authenticatedJsonGet(taskApiPaths.detail(loopId, taskId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Task request failed with status ${response.status}`));
  }

  return response.json() as Promise<Task>;
};

export const createTask = async (input: TaskCreate): Promise<Task> => {
  const response = await authenticatedJsonPost(taskApiPaths.create(), input);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Task creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Task>;
};

export const appendTaskUserMessage = async (loopId: string, taskId: string, content: string): Promise<{ appended: boolean }> => {
  const response = await authenticatedJsonPost(taskApiPaths.appendUserMessage(), { loopId, taskId, content });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Task message append failed with status ${response.status}`));
  }

  return response.json() as Promise<{ appended: boolean }>;
};

export const approveTaskToolCall = async (loopId: string, taskId: string, queueItemId: string, message?: string): Promise<{ approved: boolean }> => {
  const response = await authenticatedJsonPost(taskApiPaths.approveToolCall(), { loopId, taskId, queueItemId, message });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Tool call approval failed with status ${response.status}`));
  }

  return response.json() as Promise<{ approved: boolean }>;
};

export const rejectTaskToolCall = async (loopId: string, taskId: string, queueItemId: string, message?: string): Promise<{ rejected: boolean }> => {
  const response = await authenticatedJsonPost(taskApiPaths.rejectToolCall(), { loopId, taskId, queueItemId, message });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Tool call rejection failed with status ${response.status}`));
  }

  return response.json() as Promise<{ rejected: boolean }>;
};

export const updateTaskTitle = async (loopId: string, taskId: string, title: string): Promise<{ updated: boolean }> => {
  const response = await authenticatedJsonPost(taskApiPaths.updateTitle(), { loopId, taskId, title });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Task title update failed with status ${response.status}`));
  }

  return response.json() as Promise<{ updated: boolean }>;
};

export const updateTaskObjective = async (loopId: string, taskId: string, objective: string): Promise<{ updated: boolean }> => {
  const response = await authenticatedJsonPost(taskApiPaths.updateObjective(), { loopId, taskId, objective });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Task objective update failed with status ${response.status}`));
  }

  return response.json() as Promise<{ updated: boolean }>;
};

export const assignTaskWorkgraphItem = async (loopId: string, taskId: string, item: string): Promise<{ assigned: boolean }> => {
  const response = await authenticatedJsonPost(taskApiPaths.assignWorkgraphItem(), { loopId, taskId, item });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Task workgraph assignment failed with status ${response.status}`));
  }

  return response.json() as Promise<{ assigned: boolean }>;
};

export const fetchTaskAssignedWorkgraphItem = async (loopId: string, taskId: string): Promise<{ id: string; title: string | null; itemKey: string | null; itemType: string } | null> => {
  const response = await authenticatedJsonGet(taskApiPaths.assignedWorkgraphItem(loopId, taskId));

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Workgraph item fetch failed with status ${response.status}`));
  }

  return response.json() as Promise<{ id: string; title: string | null; itemKey: string | null; itemType: string } | null>;
};
