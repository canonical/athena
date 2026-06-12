import { getAuthenticatedUser } from "@components/authentication/authentication.controller.js";
import { getSessionId } from "@components/authentication/session.js";
import { type Request, type Response, Router } from "express";
import { createProject, deleteProject, getProject, listProjects, ProjectNotFoundError, ProjectValidationError, updateProject, validateCreateProjectRequest, validateUpdateProjectRequest } from "./project.controller.js";

export const projectRouter = Router();

const sendProjectError = (error: unknown, response: Response): boolean => {
  if (error instanceof ProjectValidationError) {
    response.status(400).json({ error: error.message });
    return true;
  }

  if (error instanceof ProjectNotFoundError) {
    response.status(404).json({ error: error.message });
    return true;
  }

  return false;
};

const getCurrentUser = async (request: Request, response: Response) => {
  const user = await getAuthenticatedUser(getSessionId(request));

  if (!user) {
    response.sendStatus(401);
    return undefined;
  }

  return user;
};

const getProjectId = (request: Request): string => {
  const projectId = request.params.projectId;

  return Array.isArray(projectId) ? (projectId[0] ?? ``) : (projectId ?? ``);
};

projectRouter.post(`/projects`, async (request: Request, response: Response) => {
  try {
    const user = await getCurrentUser(request, response);

    if (!user) {
      return;
    }

    const project = await createProject(validateCreateProjectRequest(request.body), user.id);
    response.status(201).json(project);
  } catch (error) {
    if (!sendProjectError(error, response)) {
      throw error;
    }
  }
});

projectRouter.get(`/projects`, async (request: Request, response: Response) => {
  const user = await getCurrentUser(request, response);

  if (!user) {
    return;
  }

  response.status(200).json(await listProjects(user.id));
});

projectRouter.get(`/projects/:projectId`, async (request: Request, response: Response) => {
  try {
    const user = await getCurrentUser(request, response);

    if (!user) {
      return;
    }

    response.status(200).json(await getProject(getProjectId(request), user.id));
  } catch (error) {
    if (!sendProjectError(error, response)) {
      throw error;
    }
  }
});

projectRouter.put(`/projects/:projectId`, async (request: Request, response: Response) => {
  try {
    const user = await getCurrentUser(request, response);

    if (!user) {
      return;
    }

    const project = await updateProject(getProjectId(request), validateUpdateProjectRequest(request.body), user.id);
    response.status(200).json(project);
  } catch (error) {
    if (!sendProjectError(error, response)) {
      throw error;
    }
  }
});

projectRouter.delete(`/projects/:projectId`, async (request: Request, response: Response) => {
  try {
    const user = await getCurrentUser(request, response);

    if (!user) {
      return;
    }

    await deleteProject(getProjectId(request), user.id);
    response.sendStatus(204);
  } catch (error) {
    if (!sendProjectError(error, response)) {
      throw error;
    }
  }
});
