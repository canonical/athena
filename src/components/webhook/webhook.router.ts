import { getAuthenticatedUserId } from "@components/authentication/session.js";
import { defineRoutes } from "@components/express/express.router.js";
import { uuid } from "@components/utilities/zod.utilities.js";
import { Router } from "express";
import { z } from "zod";
import { loopWorkgraphWebhookCreate, loopWorkgraphWebhookDelete, loopWorkgraphWebhookList, loopWorkgraphWebhookUpdate } from "./webhook.controller.js";
import { loopWorkgraphWebhookCreateSchema, loopWorkgraphWebhookUpdateSchema } from "./webhook.schema.js";

export const webhookRouter = Router();
const route = defineRoutes(webhookRouter);

const loopWorkgraphParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
  workgraph: uuid(`workgraph must be a valid UUID.`),
});

const loopWorkgraphWebhookParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
  workgraph: uuid(`workgraph must be a valid UUID.`),
  webhook: uuid(`webhook must be a valid UUID.`),
});

route({
  method: `get`,
  route: `/loop/:loop/workgraph/:workgraph`,
  validators: {
    params: loopWorkgraphParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const webhooks = await loopWorkgraphWebhookList(params.loop, params.workgraph, getAuthenticatedUserId(response));
    respond({ status: 200, data: webhooks });
  },
});

route({
  method: `post`,
  route: `/loop/:loop/workgraph/:workgraph`,
  validators: {
    params: loopWorkgraphParamsSchema,
    body: loopWorkgraphWebhookCreateSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const webhook = await loopWorkgraphWebhookCreate(params.loop, params.workgraph, getAuthenticatedUserId(response), body);
    respond({ status: 201, data: webhook });
  },
});

route({
  method: `put`,
  route: `/loop/:loop/workgraph/:workgraph/:webhook`,
  validators: {
    params: loopWorkgraphWebhookParamsSchema,
    body: loopWorkgraphWebhookUpdateSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const webhook = await loopWorkgraphWebhookUpdate(params.loop, params.workgraph, params.webhook, getAuthenticatedUserId(response), body);
    respond({ status: 200, data: webhook });
  },
});

route({
  method: `delete`,
  route: `/loop/:loop/workgraph/:workgraph/:webhook`,
  validators: {
    params: loopWorkgraphWebhookParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    await loopWorkgraphWebhookDelete(params.loop, params.workgraph, params.webhook, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});
