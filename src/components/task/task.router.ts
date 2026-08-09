import { getAuthenticatedUserId } from "@components/authentication/session.js";
import { defineRoutes } from "@components/express/express.router.js";
import { Router } from "express";
import { taskAppendUserMessage, taskApproveToolCall, taskCreate, taskGet, taskList, taskRejectToolCall } from "./task.controller.js";
import { taskAppendUserMessageSchema, taskCreateSchema, taskDetailParamsSchema, taskListParamsSchema, taskToolCallApprovalSchema } from "./task.schema.js";

export const taskRouter = Router();
const route = defineRoutes(taskRouter);

route({
  method: `get`,
  route: `/loop/:loopId`,
  validators: {
    params: taskListParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const tasks = await taskList(getAuthenticatedUserId(response), params.loopId);
    respond({ status: 200, data: tasks });
  },
});

route({
  method: `get`,
  route: `/loop/:loopId/:taskId`,
  validators: {
    params: taskDetailParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const task = await taskGet(getAuthenticatedUserId(response), params.loopId, params.taskId);
    respond({ status: 200, data: task });
  },
});

route({
  method: `post`,
  route: `/`,
  validators: {
    body: taskCreateSchema,
  },
  handler: async ({ body, response, respond }) => {
    const task = await taskCreate(body, getAuthenticatedUserId(response));
    respond({ status: 201, data: task });
  },
});

route({
  method: `post`,
  route: `/append-user-message`,
  validators: {
    body: taskAppendUserMessageSchema,
  },
  handler: async ({ body, response, respond }) => {
    const result = await taskAppendUserMessage(getAuthenticatedUserId(response), body);
    respond({ status: 200, data: result });
  },
});

route({
  method: `post`,
  route: `/approve-tool-call`,
  validators: {
    body: taskToolCallApprovalSchema,
  },
  handler: async ({ body, response, respond }) => {
    const result = await taskApproveToolCall(getAuthenticatedUserId(response), body);
    respond({ status: 200, data: result });
  },
});

route({
  method: `post`,
  route: `/reject-tool-call`,
  validators: {
    body: taskToolCallApprovalSchema,
  },
  handler: async ({ body, response, respond }) => {
    const result = await taskRejectToolCall(getAuthenticatedUserId(response), body);
    respond({ status: 200, data: result });
  },
});
