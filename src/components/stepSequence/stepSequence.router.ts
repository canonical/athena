import { getAuthenticatedUserId } from "@components/authentication/session.js";
import { defineRoutes } from "@components/express/express.router.js";
import { uuid } from "@components/utilities/zod.utilities.js";
import { Router } from "express";
import { z } from "zod";
import {
  stepDefinitionCreate,
  stepDefinitionDelete,
  stepDefinitionList,
  stepDefinitionReorder,
  stepDefinitionUpdate,
  stepSequenceCreate,
  stepSequenceDelete,
  stepSequenceGet,
  stepSequenceList,
  stepSequenceResolveForTaskSource,
  stepSequenceUpdate,
  taskSourceStepSequenceDelete,
  taskSourceStepSequenceList,
  taskSourceStepSequenceUpsert,
} from "./stepSequence.controller.js";
import { stepDefinitionWritableSchema, stepSequenceWritableSchema, taskSourceStepSequenceWritableSchema } from "./stepSequence.schema.js";

export const stepSequenceRouter = Router();
const route = defineRoutes(stepSequenceRouter);

const loopParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
});

const stepSequenceParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
  stepSequence: uuid(`stepSequence must be a valid UUID.`),
});

const stepDefinitionParamsSchema = stepSequenceParamsSchema.extend({
  stepDefinition: uuid(`stepDefinition must be a valid UUID.`),
});

const stepDefinitionReorderBodySchema = z.object({
  stepDefinitions: z.array(uuid(`each entry must be a valid UUID.`)).min(1),
});

const taskSourceParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
  taskSource: z.string().trim().min(1),
});

route({
  method: `get`,
  route: `/loop/:loop/list`,
  validators: { params: loopParamsSchema },
  handler: async ({ params, response, respond }) => {
    const stepSequences = await stepSequenceList(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: stepSequences });
  },
});

route({
  method: `post`,
  route: `/loop/:loop`,
  validators: { params: loopParamsSchema, body: stepSequenceWritableSchema },
  handler: async ({ params, body, response, respond }) => {
    const stepSequence = await stepSequenceCreate(params.loop, body, getAuthenticatedUserId(response));
    respond({ status: 201, data: stepSequence });
  },
});

route({
  method: `get`,
  route: `/loop/:loop/:stepSequence`,
  validators: { params: stepSequenceParamsSchema },
  handler: async ({ params, response, respond }) => {
    const stepSequence = await stepSequenceGet(params.stepSequence, params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: stepSequence });
  },
});

route({
  method: `put`,
  route: `/loop/:loop/:stepSequence`,
  validators: { params: stepSequenceParamsSchema, body: stepSequenceWritableSchema },
  handler: async ({ params, body, response, respond }) => {
    const stepSequence = await stepSequenceUpdate(params.stepSequence, params.loop, body, getAuthenticatedUserId(response));
    respond({ status: 200, data: stepSequence });
  },
});

route({
  method: `delete`,
  route: `/loop/:loop/:stepSequence`,
  validators: { params: stepSequenceParamsSchema },
  handler: async ({ params, response, respond }) => {
    await stepSequenceDelete(params.stepSequence, params.loop, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

route({
  method: `get`,
  route: `/loop/:loop/:stepSequence/step`,
  validators: { params: stepSequenceParamsSchema },
  handler: async ({ params, response, respond }) => {
    const stepDefinitions = await stepDefinitionList(params.stepSequence, params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: stepDefinitions });
  },
});

route({
  method: `post`,
  route: `/loop/:loop/:stepSequence/step`,
  validators: { params: stepSequenceParamsSchema, body: stepDefinitionWritableSchema },
  handler: async ({ params, body, response, respond }) => {
    const stepDefinition = await stepDefinitionCreate(params.stepSequence, params.loop, body, getAuthenticatedUserId(response));
    respond({ status: 201, data: stepDefinition });
  },
});

route({
  method: `put`,
  route: `/loop/:loop/:stepSequence/step/reorder`,
  validators: { params: stepSequenceParamsSchema, body: stepDefinitionReorderBodySchema },
  handler: async ({ params, body, response, respond }) => {
    const stepDefinitions = await stepDefinitionReorder(params.stepSequence, params.loop, body.stepDefinitions, getAuthenticatedUserId(response));
    respond({ status: 200, data: stepDefinitions });
  },
});

route({
  method: `put`,
  route: `/loop/:loop/:stepSequence/step/:stepDefinition`,
  validators: { params: stepDefinitionParamsSchema, body: stepDefinitionWritableSchema },
  handler: async ({ params, body, response, respond }) => {
    const stepDefinition = await stepDefinitionUpdate(params.stepDefinition, params.stepSequence, params.loop, body, getAuthenticatedUserId(response));
    respond({ status: 200, data: stepDefinition });
  },
});

route({
  method: `delete`,
  route: `/loop/:loop/:stepSequence/step/:stepDefinition`,
  validators: { params: stepDefinitionParamsSchema },
  handler: async ({ params, response, respond }) => {
    await stepDefinitionDelete(params.stepDefinition, params.stepSequence, params.loop, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

route({
  method: `get`,
  route: `/loop/:loop/mapping/list`,
  validators: { params: loopParamsSchema },
  handler: async ({ params, response, respond }) => {
    const mappings = await taskSourceStepSequenceList(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: mappings });
  },
});

route({
  method: `put`,
  route: `/loop/:loop/mapping`,
  validators: { params: loopParamsSchema, body: taskSourceStepSequenceWritableSchema },
  handler: async ({ params, body, response, respond }) => {
    const mapping = await taskSourceStepSequenceUpsert(params.loop, body, getAuthenticatedUserId(response));
    respond({ status: 200, data: mapping });
  },
});

route({
  method: `delete`,
  route: `/loop/:loop/mapping/:taskSource`,
  validators: { params: taskSourceParamsSchema },
  handler: async ({ params, response, respond }) => {
    await taskSourceStepSequenceDelete(params.loop, params.taskSource, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

route({
  method: `get`,
  route: `/loop/:loop/resolve/:taskSource`,
  validators: { params: taskSourceParamsSchema },
  handler: async ({ params, respond }) => {
    const resolution = await stepSequenceResolveForTaskSource(params.loop, params.taskSource);
    respond({ status: 200, data: resolution });
  },
});
