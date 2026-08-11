import { getAuthenticatedUserId } from "@components/authentication/session.js";
import { defineRoutes } from "@components/express/express.router.js";
import { uuid } from "@components/utilities/zod.utilities.js";
import { Router } from "express";
import { z } from "zod";
import { loopRunnerCreate, loopRunnerDelete, loopRunnerList, loopRunnerSessions, loopRunnerUpdateByAdmin, runnerCreate, runnerDelete, runnerGet, runnerList, runnerSessions, runnerUpdate } from "./runner.controller.js";
import { loopRunnerAdminUpdateSchema, runnerInsertSchema, runnerUpdateSchema } from "./runner.schema.js";

export const runnerRouter = Router();
const route = defineRoutes(runnerRouter);

const runnerParamsSchema = z.object({
  runner: uuid(`runner must be a valid UUID.`),
});

const loopParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
});

const loopRunnerParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
  runner: uuid(`runner must be a valid UUID.`),
});

const runnerDeleteBodySchema = z.object({
  runner: uuid(`runner must be a valid UUID.`),
});

const runnerAssignBodySchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
  runner: uuid(`runner must be a valid UUID.`),
});

route({
  method: `get`,
  route: `/`,
  handler: async ({ response, respond }) => {
    const runners = await runnerList(getAuthenticatedUserId(response));
    respond({ status: 200, data: runners });
  },
});

route({
  method: `post`,
  route: `/`,
  validators: {
    body: runnerInsertSchema,
  },
  handler: async ({ body, response, respond }) => {
    const runner = await runnerCreate(body, getAuthenticatedUserId(response));
    respond({ status: 201, data: runner });
  },
});

route({
  method: `delete`,
  route: `/`,
  validators: {
    body: runnerDeleteBodySchema,
  },
  handler: async ({ body, response, respond }) => {
    await runnerDelete(body.runner, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

route({
  method: `get`,
  route: `/:runner`,
  validators: {
    params: runnerParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const runner = await runnerGet(params.runner, getAuthenticatedUserId(response));
    respond({ status: 200, data: runner });
  },
});

route({
  method: `get`,
  route: `/:runner/sessions`,
  validators: {
    params: runnerParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const result = await runnerSessions(params.runner, getAuthenticatedUserId(response));
    respond({ status: 200, data: result });
  },
});

route({
  method: `put`,
  route: `/:runner`,
  validators: {
    params: runnerParamsSchema,
    body: runnerUpdateSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const runner = await runnerUpdate(params.runner, getAuthenticatedUserId(response), body);
    respond({ status: 200, data: runner });
  },
});

route({
  method: `get`,
  route: `/loop/:loop/list`,
  validators: {
    params: loopParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const runners = await loopRunnerList(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: runners });
  },
});

route({
  method: `get`,
  route: `/loop/:loop/sessions`,
  validators: {
    params: loopParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const result = await loopRunnerSessions(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: result });
  },
});

route({
  method: `post`,
  route: `/assign`,
  validators: {
    body: runnerAssignBodySchema,
  },
  handler: async ({ body, response, respond }) => {
    await loopRunnerCreate(body.loop, getAuthenticatedUserId(response), { runner: body.runner });
    respond({ status: 204 });
  },
});

route({
  method: `put`,
  route: `/loop/:loop/:runner/admin`,
  validators: {
    params: loopRunnerParamsSchema,
    body: loopRunnerAdminUpdateSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const runner = await loopRunnerUpdateByAdmin(params.loop, params.runner, getAuthenticatedUserId(response), body);
    respond({ status: 200, data: runner });
  },
});

route({
  method: `delete`,
  route: `/unassign`,
  validators: {
    body: runnerAssignBodySchema,
  },
  handler: async ({ body, response, respond }) => {
    await loopRunnerDelete(body.loop, body.runner, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});
