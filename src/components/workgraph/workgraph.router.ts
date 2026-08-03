import { getAuthenticatedUserId } from "@components/authentication/session.js";
import { defineRoutes } from "@components/express/express.router.js";
import { uuid } from "@components/utilities/zod.utilities.js";
import { Router } from "express";
import { z } from "zod";
import {
  loopWorkgraphDelete,
  loopWorkgraphList,
  loopWorkgraphUpdateByAdmin,
  workgraphAssign,
  workgraphCreate,
  workgraphDelete,
  workgraphGet,
  workgraphList,
  workgraphTestConnection,
  workgraphTypeOptions,
  workgraphUpdate,
} from "./workgraph.controller.js";
import { loopWorkgraphAdminUpdateSchema, loopWorkgraphAssignSchema, workgraphConnectionTestSchema, workgraphInsertSchema, workgraphUpdateSchema } from "./workgraph.schema.js";

export const workgraphRouter = Router();
const route = defineRoutes(workgraphRouter);

const workgraphParamsSchema = z.object({
  workgraph: uuid(`workgraph must be a valid UUID.`),
});

const loopParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
});

const loopWorkgraphParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
  workgraph: uuid(`workgraph must be a valid UUID.`),
});

const workgraphDeleteBodySchema = z.object({
  workgraph: uuid(`workgraph must be a valid UUID.`),
});


route({
  method: `get`,
  route: `/types`,
  handler: async ({ respond }) => {
    respond({ status: 200, data: workgraphTypeOptions() });
  },
});

route({
  method: `get`,
  route: `/`,
  handler: async ({ response, respond }) => {
    const workgraphs = await workgraphList(getAuthenticatedUserId(response));
    respond({ status: 200, data: workgraphs });
  },
});

route({
  method: `post`,
  route: `/`,
  validators: {
    body: workgraphInsertSchema,
  },
  handler: async ({ body, response, respond }) => {
    const workgraph = await workgraphCreate(body, getAuthenticatedUserId(response));
    respond({ status: 201, data: workgraph });
  },
});

route({
  method: `post`,
  route: `/test`,
  validators: {
    body: workgraphConnectionTestSchema,
  },
  handler: async ({ body, respond }) => {
    const result = await workgraphTestConnection(body);
    respond({ status: 200, data: result });
  },
});

route({
  method: `delete`,
  route: `/`,
  validators: {
    body: workgraphDeleteBodySchema,
  },
  handler: async ({ body, response, respond }) => {
    await workgraphDelete(body.workgraph, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

route({
  method: `get`,
  route: `/:workgraph`,
  validators: {
    params: workgraphParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const workgraph = await workgraphGet(params.workgraph, getAuthenticatedUserId(response));
    respond({ status: 200, data: workgraph });
  },
});

route({
  method: `put`,
  route: `/:workgraph`,
  validators: {
    params: workgraphParamsSchema,
    body: workgraphUpdateSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const workgraph = await workgraphUpdate(params.workgraph, getAuthenticatedUserId(response), body);
    respond({ status: 200, data: workgraph });
  },
});

route({
  method: `get`,
  route: `/loop/:loop/list`,
  validators: {
    params: loopParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const workgraphs = await loopWorkgraphList(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: workgraphs });
  },
});

route({
  method: `post`,
  route: `/assign`,
  validators: {
    body: loopWorkgraphAssignSchema,
  },
  handler: async ({ body, response, respond }) => {
    await workgraphAssign(getAuthenticatedUserId(response), body);
    respond({ status: 204 });
  },
});

route({
  method: `put`,
  route: `/loop/:loop/:workgraph/admin`,
  validators: {
    params: loopWorkgraphParamsSchema,
    body: loopWorkgraphAdminUpdateSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const workgraph = await loopWorkgraphUpdateByAdmin(params.loop, params.workgraph, getAuthenticatedUserId(response), body);
    respond({ status: 200, data: workgraph });
  },
});

route({
  method: `delete`,
  route: `/unassign`,
  validators: {
    body: loopWorkgraphAssignSchema,
  },
  handler: async ({ body, response, respond }) => {
    await loopWorkgraphDelete(body.loop, body.workgraph, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});
