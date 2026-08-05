import { getAuthenticatedUserId } from "@components/authentication/session.js";
import { defineRoutes } from "@components/express/express.router.js";
import { uuid } from "@components/utilities/zod.utilities.js";
import { Router } from "express";
import { z } from "zod";
import { loopCreate, loopDelete, loopGet, loopList, loopLlmToolsGet, loopLlmToolsUpdate, loopProviderSelectionPolicyGet, loopProviderSelectionPolicyUpdate, loopReadinessGet, loopUpdate } from "./loop.controller.js";
import { loopInsertSchema, loopLlmToolsUpdateRequestSchema, loopUpdateSchema, providerSelectionPolicyUpdateSchema } from "./loop.schema.js";

export const loopRouter = Router();
const route = defineRoutes(loopRouter);

const loopParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
});

route({
  method: `post`,
  route: `/`,
  validators: { body: loopInsertSchema },
  handler: async ({ body, response, respond }) => {
    const loop = await loopCreate(body, getAuthenticatedUserId(response));
    respond({ status: 201, data: loop });
  },
});

route({
  method: `get`,
  route: `/`,
  handler: async ({ response, respond }) => {
    const loops = await loopList(getAuthenticatedUserId(response));
    respond({ status: 200, data: loops });
  },
});

route({
  method: `get`,
  route: `/:loop`,
  validators: {
    params: loopParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const loop = await loopGet(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: loop });
  },
});

route({
  method: `put`,
  route: `/:loop`,
  validators: {
    params: loopParamsSchema,
    body: loopUpdateSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const loop = await loopUpdate(params.loop, body, getAuthenticatedUserId(response));
    respond({ status: 200, data: loop });
  },
});

route({
  method: `delete`,
  route: `/:loop`,
  validators: {
    params: loopParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    await loopDelete(params.loop, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

route({
  method: `get`,
  route: `/:loop/provider-selection-policy`,
  validators: {
    params: loopParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const policy = await loopProviderSelectionPolicyGet(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: policy });
  },
});

route({
  method: `put`,
  route: `/:loop/provider-selection-policy`,
  validators: {
    params: loopParamsSchema,
    body: providerSelectionPolicyUpdateSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const policy = await loopProviderSelectionPolicyUpdate(params.loop, getAuthenticatedUserId(response), body);
    respond({ status: 200, data: policy });
  },
});

route({
  method: `get`,
  route: `/:loop/readiness`,
  validators: {
    params: loopParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const readiness = await loopReadinessGet(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: readiness });
  },
});

route({
  method: `get`,
  route: `/:loop/llm-tools`,
  validators: {
    params: loopParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const tools = await loopLlmToolsGet(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: tools });
  },
});

route({
  method: `put`,
  route: `/:loop/llm-tools`,
  validators: {
    params: loopParamsSchema,
    body: loopLlmToolsUpdateRequestSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const tools = await loopLlmToolsUpdate(params.loop, getAuthenticatedUserId(response), body);
    respond({ status: 200, data: tools });
  },
});
