import { getAuthenticatedUserId } from "@components/authentication/session.js";
import { defineRoutes } from "@components/express/express.router.js";
import { resolveRequestLogger } from "@components/logging/logging.service.js";
import { uuid } from "@components/utilities/zod.utilities.js";
import { Router } from "express";
import { z } from "zod";
import { loopProviderDelete, loopProviderList, loopProviderUpdateByAdmin, providerAssign, providerCreate, providerDelete, providerGet, providerList, providerModelPreview, providerModels, providerUpdate } from "./provider.controller.js";
import { loopProviderAdminUpdateSchema, providerInsertSchema, providerModelPreviewRequestSchema, providerUpdateSchema } from "./provider.schema.js";

export const providerRouter = Router();
const route = defineRoutes(providerRouter);

const providerParamsSchema = z.object({
  provider: uuid(`provider must be a valid UUID.`),
});

const loopParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
});

const loopProviderParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
  provider: uuid(`provider must be a valid UUID.`),
});

const providerDeleteBodySchema = z.object({
  provider: uuid(`provider must be a valid UUID.`),
});

const providerAssignBodySchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
  provider: uuid(`provider must be a valid UUID.`),
});

route({
  method: `get`,
  route: `/`,
  handler: async ({ response, respond }) => {
    const providers = await providerList(getAuthenticatedUserId(response));
    respond({ status: 200, data: providers });
  },
});

route({
  method: `post`,
  route: `/`,
  validators: {
    body: providerInsertSchema,
  },
  handler: async ({ body, response, respond }) => {
    const provider = await providerCreate(body, getAuthenticatedUserId(response));
    respond({ status: 201, data: provider });
  },
});

route({
  method: `delete`,
  route: `/`,
  validators: {
    body: providerDeleteBodySchema,
  },
  handler: async ({ body, response, respond }) => {
    await providerDelete(body.provider, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

route({
  method: `get`,
  route: `/:provider`,
  validators: {
    params: providerParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const provider = await providerGet(params.provider, getAuthenticatedUserId(response));
    respond({ status: 200, data: provider });
  },
});

route({
  method: `put`,
  route: `/:provider`,
  validators: {
    params: providerParamsSchema,
    body: providerUpdateSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const provider = await providerUpdate(params.provider, getAuthenticatedUserId(response), body);
    respond({ status: 200, data: provider });
  },
});

route({
  method: `get`,
  route: `/:provider/models`,
  validators: {
    params: providerParamsSchema,
  },
  handler: async ({ params, request, response, respond }) => {
    const models = await providerModels(params.provider, getAuthenticatedUserId(response), resolveRequestLogger(request));
    respond({ status: 200, data: { models } });
  },
});

route({
  method: `post`,
  route: `/models/preview`,
  validators: {
    body: providerModelPreviewRequestSchema,
  },
  handler: async ({ body, request, respond }) => {
    const models = await providerModelPreview(body, resolveRequestLogger(request));
    respond({ status: 200, data: { models } });
  },
});

route({
  method: `get`,
  route: `/loop/:loop/list`,
  validators: {
    params: loopParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const providers = await loopProviderList(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: providers });
  },
});

route({
  method: `post`,
  route: `/assign`,
  validators: {
    body: providerAssignBodySchema,
  },
  handler: async ({ body, response, respond }) => {
    await providerAssign(body.loop, getAuthenticatedUserId(response), { provider: body.provider });
    respond({ status: 204 });
  },
});

route({
  method: `put`,
  route: `/loop/:loop/:provider/admin`,
  validators: {
    params: loopProviderParamsSchema,
    body: loopProviderAdminUpdateSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const provider = await loopProviderUpdateByAdmin(params.loop, params.provider, getAuthenticatedUserId(response), body);
    respond({ status: 200, data: provider });
  },
});

route({
  method: `delete`,
  route: `/unassign`,
  validators: {
    body: providerAssignBodySchema,
  },
  handler: async ({ body, response, respond }) => {
    await loopProviderDelete(body.loop, body.provider, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});
