import { getAuthenticatedUserId } from "@components/authentication/session.js";
import { defineRoutes } from "@components/express/express.router.js";
import { uuid } from "@components/utilities/zod.utilities.js";
import { Router } from "express";
import { z } from "zod";
import { taskCreate, taskListByLoop, taskMarkBlocked, taskMarkCompleted, taskProcessQueue, taskUpdateContext } from "./task.controller.js";
import { markTaskBlockedRequestSchema, markTaskCompletedRequestSchema, updateTaskContextRequestSchema, validatedCreateTaskRequestSchema } from "./task.schema.js";

export const taskRouter = Router();
const route = defineRoutes(taskRouter);

const taskListQuerySchema = z.object({
  loop: uuid(`loop must be a valid UUID.`).optional(),
});

route({
  method: `post`,
  route: `/loop`,
  validators: {
    body: validatedCreateTaskRequestSchema,
  },
  handler: async ({ body, response, respond }) => {
    const result = await taskCreate(body, getAuthenticatedUserId(response));
    respond({ status: 201, data: result });
  },
});

route({
  method: `get`,
  route: `/loop`,
  validators: {
    query: taskListQuerySchema,
  },
  handler: async ({ query, response, respond }) => {
    const tasks = await taskListByLoop(getAuthenticatedUserId(response), query.loop);
    respond({ status: 200, data: tasks });
  },
});

route({
  method: `post`,
  route: `/loop/complete`,
  validators: {
    body: markTaskCompletedRequestSchema,
  },
  handler: async ({ body, response, respond }) => {
    const task = await taskMarkCompleted(body.loop, getAuthenticatedUserId(response), body.note, body.taskId);
    respond({ status: 200, data: task });
  },
});

route({
  method: `post`,
  route: `/loop/blocked`,
  validators: {
    body: markTaskBlockedRequestSchema,
  },
  handler: async ({ body, response, respond }) => {
    const task = await taskMarkBlocked(body.loop, getAuthenticatedUserId(response), body.blocker, body.note, body.taskId);
    respond({ status: 200, data: task });
  },
});

route({
  method: `post`,
  route: `/loop/context`,
  validators: {
    body: updateTaskContextRequestSchema,
  },
  handler: async ({ body, response, respond }) => {
    const task = await taskUpdateContext(body.loop, getAuthenticatedUserId(response), body.context, body.note, body.taskId);
    respond({ status: 200, data: task });
  },
});

route({
  method: `post`,
  route: `/queue/process`,
  handler: async ({ respond }) => {
    const result = await taskProcessQueue();
    respond({ status: 200, data: result });
  },
});
