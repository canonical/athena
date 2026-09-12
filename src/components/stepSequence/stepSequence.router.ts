import { getAuthenticatedUserId } from "@components/authentication/session.js";
import { defineRoutes } from "@components/express/express.router.js";
import { Router } from "express";
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
import {
  stepDefinitionParamsSchema,
  stepDefinitionReorderBodySchema,
  stepDefinitionWritableSchema,
  stepSequenceLoopParamsSchema,
  stepSequenceParamsSchema,
  stepSequenceWritableSchema,
  taskSourceStepSequenceParamsSchema,
  taskSourceStepSequenceWritableSchema,
} from "./stepSequence.schema.js";

export const stepSequenceRouter = Router();
const route = defineRoutes(stepSequenceRouter);

/**
 * GET /loop/:loop/list
 * List every step sequence defined for a loop.
 */
route({
  method: `get`,
  route: `/loop/:loop/list`,
  validators: { params: stepSequenceLoopParamsSchema },
  handler: async ({ params, response, respond }) => {
    const stepSequences = await stepSequenceList(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: stepSequences });
  },
});

/**
 * POST /loop/:loop
 * Create a new named step sequence for a loop.
 */
route({
  method: `post`,
  route: `/loop/:loop`,
  validators: { params: stepSequenceLoopParamsSchema, body: stepSequenceWritableSchema },
  handler: async ({ params, body, response, respond }) => {
    const stepSequence = await stepSequenceCreate(params.loop, body, getAuthenticatedUserId(response));
    respond({ status: 201, data: stepSequence });
  },
});

/**
 * GET /loop/:loop/:stepSequence
 * Get a step sequence and its ordered step definitions.
 */
route({
  method: `get`,
  route: `/loop/:loop/:stepSequence`,
  validators: { params: stepSequenceParamsSchema },
  handler: async ({ params, response, respond }) => {
    const stepSequence = await stepSequenceGet(params.stepSequence, params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: stepSequence });
  },
});

/**
 * PUT /loop/:loop/:stepSequence
 * Rename a step sequence or change its default flag.
 */
route({
  method: `put`,
  route: `/loop/:loop/:stepSequence`,
  validators: { params: stepSequenceParamsSchema, body: stepSequenceWritableSchema },
  handler: async ({ params, body, response, respond }) => {
    const stepSequence = await stepSequenceUpdate(params.stepSequence, params.loop, body, getAuthenticatedUserId(response));
    respond({ status: 200, data: stepSequence });
  },
});

/**
 * DELETE /loop/:loop/:stepSequence
 * Delete a step sequence. Never cascades into existing task data.
 */
route({
  method: `delete`,
  route: `/loop/:loop/:stepSequence`,
  validators: { params: stepSequenceParamsSchema },
  handler: async ({ params, response, respond }) => {
    await stepSequenceDelete(params.stepSequence, params.loop, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

/**
 * GET /loop/:loop/:stepSequence/step
 * List the ordered step definitions in a sequence.
 */
route({
  method: `get`,
  route: `/loop/:loop/:stepSequence/step`,
  validators: { params: stepSequenceParamsSchema },
  handler: async ({ params, response, respond }) => {
    const stepDefinitions = await stepDefinitionList(params.stepSequence, params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: stepDefinitions });
  },
});

/**
 * POST /loop/:loop/:stepSequence/step
 * Add a new step definition to a sequence.
 */
route({
  method: `post`,
  route: `/loop/:loop/:stepSequence/step`,
  validators: { params: stepSequenceParamsSchema, body: stepDefinitionWritableSchema },
  handler: async ({ params, body, response, respond }) => {
    const stepDefinition = await stepDefinitionCreate(params.stepSequence, params.loop, body, getAuthenticatedUserId(response));
    respond({ status: 201, data: stepDefinition });
  },
});

/**
 * PUT /loop/:loop/:stepSequence/step/reorder
 * Reorder every step definition in a sequence atomically.
 */
route({
  method: `put`,
  route: `/loop/:loop/:stepSequence/step/reorder`,
  validators: { params: stepSequenceParamsSchema, body: stepDefinitionReorderBodySchema },
  handler: async ({ params, body, response, respond }) => {
    const stepDefinitions = await stepDefinitionReorder(params.stepSequence, params.loop, body.stepDefinitions, getAuthenticatedUserId(response));
    respond({ status: 200, data: stepDefinitions });
  },
});

/**
 * PUT /loop/:loop/:stepSequence/step/:stepDefinition
 * Update a single step definition's fields.
 */
route({
  method: `put`,
  route: `/loop/:loop/:stepSequence/step/:stepDefinition`,
  validators: { params: stepDefinitionParamsSchema, body: stepDefinitionWritableSchema },
  handler: async ({ params, body, response, respond }) => {
    const stepDefinition = await stepDefinitionUpdate(params.stepDefinition, params.stepSequence, params.loop, body, getAuthenticatedUserId(response));
    respond({ status: 200, data: stepDefinition });
  },
});

/**
 * DELETE /loop/:loop/:stepSequence/step/:stepDefinition
 * Remove a step definition from a sequence.
 */
route({
  method: `delete`,
  route: `/loop/:loop/:stepSequence/step/:stepDefinition`,
  validators: { params: stepDefinitionParamsSchema },
  handler: async ({ params, response, respond }) => {
    await stepDefinitionDelete(params.stepDefinition, params.stepSequence, params.loop, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

/**
 * GET /loop/:loop/mapping/list
 * List every task-source-to-step-sequence mapping for a loop.
 */
route({
  method: `get`,
  route: `/loop/:loop/mapping/list`,
  validators: { params: stepSequenceLoopParamsSchema },
  handler: async ({ params, response, respond }) => {
    const mappings = await taskSourceStepSequenceList(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: mappings });
  },
});

/**
 * PUT /loop/:loop/mapping
 * Create or replace the step sequence mapped to a task source.
 */
route({
  method: `put`,
  route: `/loop/:loop/mapping`,
  validators: { params: stepSequenceLoopParamsSchema, body: taskSourceStepSequenceWritableSchema },
  handler: async ({ params, body, response, respond }) => {
    const mapping = await taskSourceStepSequenceUpsert(params.loop, body, getAuthenticatedUserId(response));
    respond({ status: 200, data: mapping });
  },
});

/**
 * DELETE /loop/:loop/mapping/:taskSource
 * Remove a task source's mapping, so it falls back to the loop default.
 */
route({
  method: `delete`,
  route: `/loop/:loop/mapping/:taskSource`,
  validators: { params: taskSourceStepSequenceParamsSchema },
  handler: async ({ params, response, respond }) => {
    await taskSourceStepSequenceDelete(params.loop, params.taskSource, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

/**
 * GET /loop/:loop/resolve/:taskSource
 * Resolve the step sequence that applies to new tasks for a task source:
 * a specific mapping wins, otherwise the loop default is used.
 */
route({
  method: `get`,
  route: `/loop/:loop/resolve/:taskSource`,
  validators: { params: taskSourceStepSequenceParamsSchema },
  handler: async ({ params, respond }) => {
    const resolution = await stepSequenceResolveForTaskSource(params.loop, params.taskSource);
    respond({ status: 200, data: resolution });
  },
});
