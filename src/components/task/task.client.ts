import { authenticatedJsonGet, authenticatedJsonPost } from "@components/authentication/authenticated-fetch.client.js";
import { getApiUrl } from "@components/config/frontend.client.js";
import { RouteSelectionRequiredClientError } from "./task.errors.js";
import type { CreateTaskRequest, CreateTaskResponse, MarkTaskBlockedRequest, MarkTaskCompletedRequest, RouteSelectionRequired, Task, UpdateTaskContextRequest } from "./task.schema.js";

export const taskApiPaths = {
  list: getApiUrl(`/task/loop`),
  complete: getApiUrl(`/task/loop/complete`),
  blocked: getApiUrl(`/task/loop/blocked`),
  context: getApiUrl(`/task/loop/context`),
} as const;

const readErrorPayload = async (response: Response): Promise<{ error?: string; message?: string; code?: string; options?: unknown[] }> => {
  try {
    return (await response.json()) as { error?: string; message?: string; code?: string; options?: unknown[] };
  } catch {
    return {};
  }
};

export const fetchTasks = async (loopId?: string): Promise<Task[]> => {
  const path = loopId ? `${taskApiPaths.list}?loop=${encodeURIComponent(loopId)}` : taskApiPaths.list;
  const response = await authenticatedJsonGet(path);

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw new Error(payload.error ?? `Tasks request failed with status ${response.status}`);
  }

  return response.json() as Promise<Task[]>;
};

export const createTask = async (request: CreateTaskRequest): Promise<CreateTaskResponse> => {
  const response = await authenticatedJsonPost(taskApiPaths.list, request);

  if (response.status === 409) {
    const payload = (await readErrorPayload(response)) as RouteSelectionRequired;

    if (payload.code === `ROUTE_SELECTION_REQUIRED` && Array.isArray(payload.options)) {
      throw new RouteSelectionRequiredClientError(payload);
    }
  }

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw new Error(payload.error ?? `Task creation failed with status ${response.status}`);
  }

  return response.json() as Promise<CreateTaskResponse>;
};

export const markTaskCompleted = async (request: MarkTaskCompletedRequest): Promise<Task> => {
  const response = await authenticatedJsonPost(taskApiPaths.complete, request);

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw new Error(payload.error ?? `Mark task complete failed with status ${response.status}`);
  }

  return response.json() as Promise<Task>;
};

export const markTaskBlocked = async (request: MarkTaskBlockedRequest): Promise<Task> => {
  const response = await authenticatedJsonPost(taskApiPaths.blocked, request);

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw new Error(payload.error ?? `Mark task blocked failed with status ${response.status}`);
  }

  return response.json() as Promise<Task>;
};

export const updateTaskContext = async (request: UpdateTaskContextRequest): Promise<Task> => {
  const response = await authenticatedJsonPost(taskApiPaths.context, request);

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw new Error(payload.error ?? `Update task context failed with status ${response.status}`);
  }

  return response.json() as Promise<Task>;
};
