import { getAuthenticatedUserId } from "@components/authentication/session.js";
import { defineRoutes } from "@components/express/express.router.js";
import { uuid } from "@components/utilities/zod.utilities.js";
import { Router } from "express";
import { z } from "zod";
import {
  loopRepositoryDelete,
  loopRepositoryList,
  repositoryAssign,
  repositoryCreate,
  repositoryDelete,
  repositoryGet,
  repositoryList,
  repositoryTestConnection,
  repositoryTestConnectionById,
  repositoryUpdate,
} from "./repository.controller.js";
import { loopRepositoryAssignSchema, repositoryConnectionTestSchema, repositoryInsertSchema, repositoryUpdateSchema } from "./repository.schema.js";

export const repositoryRouter = Router();
const route = defineRoutes(repositoryRouter);

const repositoryParamsSchema = z.object({
  repository: uuid(`repository must be a valid UUID.`),
});

const repositoryDeleteBodySchema = z.object({
  repository: uuid(`repository must be a valid UUID.`),
});

const loopParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
});

const repositoryAssignBodySchema = loopRepositoryAssignSchema;

route({
  method: `get`,
  route: `/`,
  handler: async ({ response, respond }) => {
    const repositories = await repositoryList(getAuthenticatedUserId(response));
    respond({ status: 200, data: repositories });
  },
});

route({
  method: `post`,
  route: `/`,
  validators: {
    body: repositoryInsertSchema,
  },
  handler: async ({ body, response, respond }) => {
    const repository = await repositoryCreate(body, getAuthenticatedUserId(response));
    respond({ status: 201, data: repository });
  },
});

route({
  method: `post`,
  route: `/test`,
  validators: {
    body: repositoryConnectionTestSchema,
  },
  handler: async ({ body, respond }) => {
    const result = await repositoryTestConnection(body);
    respond({ status: 200, data: result });
  },
});

route({
  method: `post`,
  route: `/:repository/test`,
  validators: {
    params: repositoryParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const result = await repositoryTestConnectionById(params.repository, getAuthenticatedUserId(response));
    respond({ status: 200, data: result });
  },
});

route({
  method: `delete`,
  route: `/`,
  validators: {
    body: repositoryDeleteBodySchema,
  },
  handler: async ({ body, response, respond }) => {
    await repositoryDelete(body.repository, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

route({
  method: `get`,
  route: `/:repository`,
  validators: {
    params: repositoryParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const repository = await repositoryGet(params.repository, getAuthenticatedUserId(response));
    respond({ status: 200, data: repository });
  },
});

route({
  method: `put`,
  route: `/:repository`,
  validators: {
    params: repositoryParamsSchema,
    body: repositoryUpdateSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const repository = await repositoryUpdate(params.repository, getAuthenticatedUserId(response), body);
    respond({ status: 200, data: repository });
  },
});

route({
  method: `get`,
  route: `/loop/:loop/list`,
  validators: {
    params: loopParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const repositories = await loopRepositoryList(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: repositories });
  },
});

route({
  method: `post`,
  route: `/assign`,
  validators: {
    body: repositoryAssignBodySchema,
  },
  handler: async ({ body, response, respond }) => {
    await repositoryAssign(getAuthenticatedUserId(response), body);
    respond({ status: 204 });
  },
});

route({
  method: `delete`,
  route: `/unassign`,
  validators: {
    body: repositoryAssignBodySchema,
  },
  handler: async ({ body, response, respond }) => {
    await loopRepositoryDelete(body.loop, body.repository, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});
