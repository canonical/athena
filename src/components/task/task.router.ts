import { getAuthenticatedUser, getAuthenticatedUserId } from "@components/authentication/session.js";
import { defineRoutes } from "@components/express/express.router.js";
import { Router } from "express";
import { taskAppendUserMessage, taskApproveToolCall, taskAssignWorkgraphItem, taskCreate, taskGet, taskGetAssignedWorkgraphItem, taskList, taskRejectToolCall, taskUpdateObjective, taskUpdateTitle } from "./task.controller.js";
import { taskAppendUserMessageSchema, taskAssignWorkgraphItemSchema, taskCreateSchema, taskDetailParamsSchema, taskListParamsSchema, taskToolCallApprovalSchema, taskUpdateObjectiveSchema, taskUpdateTitleSchema } from "./task.schema.js";

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
  route: `/loop/:loopId/:taskId/workgraph-item`,
  validators: { params: taskDetailParamsSchema },
  handler: async ({ params, response, respond }) => {
    const result = await taskGetAssignedWorkgraphItem(getAuthenticatedUserId(response), params.loopId, params.taskId);
    respond({ status: 200, data: result });
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
    const result = await taskAppendUserMessage(getAuthenticatedUser(response), body);
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
    const result = await taskApproveToolCall(getAuthenticatedUser(response), body);
    respond({ status: 200, data: result });
  },
});

route({
  method: `post`,
  route: `/reject-tool-call`,
  validators: { body: taskToolCallApprovalSchema },
  handler: async ({ body, response, respond }) => {
    const result = await taskRejectToolCall(getAuthenticatedUser(response), body);
    respond({ status: 200, data: result });
  },
});

route({
  method: `post`,
  route: `/update-title`,
  validators: { body: taskUpdateTitleSchema },
  handler: async ({ body, response, respond }) => {
    const result = await taskUpdateTitle(getAuthenticatedUserId(response), body.loopId, body.taskId, body.title);
    respond({ status: 200, data: result });
  },
});

route({
  method: `post`,
  route: `/update-objective`,
  validators: { body: taskUpdateObjectiveSchema },
  handler: async ({ body, response, respond }) => {
    const result = await taskUpdateObjective(getAuthenticatedUserId(response), body.loopId, body.taskId, body.objective);
    respond({ status: 200, data: result });
  },
});

route({
  method: `post`,
  route: `/assign-workgraph-item`,
  validators: { body: taskAssignWorkgraphItemSchema },
  handler: async ({ body, response, respond }) => {
    const result = await taskAssignWorkgraphItem(getAuthenticatedUserId(response), body.loopId, body.taskId, body.item);
    respond({ status: 200, data: result });
  },
});
