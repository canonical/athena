import { getApiUrl } from "@components/config/frontend.client.js";
import type { Project } from "./project.schema.js";

export type ProjectPayload = {
  name: string;
  description: string;
};

export const projectApiPaths = {
  list: getApiUrl(`/projects`),
  byId: (projectId: string) => getApiUrl(`/projects/${projectId}`),
} as const;

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const fetchProjects = async (): Promise<Project[]> => {
  const response = await fetch(projectApiPaths.list, { credentials: `include` });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Projects request failed with status ${response.status}`));
  }

  return response.json() as Promise<Project[]>;
};

export const fetchProject = async (projectId: string): Promise<Project> => {
  const response = await fetch(projectApiPaths.byId(projectId), { credentials: `include` });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Project request failed with status ${response.status}`));
  }

  return response.json() as Promise<Project>;
};

export const createProject = async (payload: ProjectPayload): Promise<Project> => {
  const response = await fetch(projectApiPaths.list, {
    method: `POST`,
    headers: { "Content-Type": `application/json` },
    credentials: `include`,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Project creation failed with status ${response.status}`));
  }

  return response.json() as Promise<Project>;
};

export const updateProject = async (projectId: string, payload: ProjectPayload): Promise<Project> => {
  const response = await fetch(projectApiPaths.byId(projectId), {
    method: `PUT`,
    headers: { "Content-Type": `application/json` },
    credentials: `include`,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Project update failed with status ${response.status}`));
  }

  return response.json() as Promise<Project>;
};

export const deleteProject = async (projectId: string): Promise<void> => {
  const response = await fetch(projectApiPaths.byId(projectId), {
    method: `DELETE`,
    credentials: `include`,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Project deletion failed with status ${response.status}`));
  }
};
