import { getAuthenticatedUserId } from "@components/authentication/session.js";
import { defineRoutes } from "@components/express/express.router.js";
import { loopMemoryGet, loopMemoryUpdate } from "@components/loop-memory/loop-memory.controller.js";
import { loopMemoryConfigUpdateSchema } from "@components/loop-memory/loop-memory.schema.js";
import { uuid } from "@components/utilities/zod.utilities.js";
import { Router } from "express";
import { z } from "zod";
import {
  loopCreate,
  loopDelete,
  loopGet,
  loopInviteAccept,
  loopInviteCreate,
  loopInvitePendingForUserList,
  loopInviteReject,
  loopInviteRevoke,
  loopList,
  loopMembershipGet,
  loopProviderSelectionPolicyGet,
  loopProviderSelectionPolicyUpdate,
  loopReadinessGet,
  loopToolsGet,
  loopToolsUpdate,
  loopUpdate,
  loopUserAdminUpdate,
} from "./loop.controller.js";
import { loopInsertSchema, loopInviteCreateSchema, loopToolsUpdateRequestSchema, loopUpdateSchema, loopUserAdminUpdateSchema, providerSelectionPolicyUpdateSchema } from "./loop.schema.js";

export const loopRouter = Router();
const route = defineRoutes(loopRouter);

const loopParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
});

const inviteParamsSchema = z.object({
  invite: uuid(`invite must be a valid UUID.`),
});

const loopInviteParamsSchema = loopParamsSchema.merge(inviteParamsSchema);

route({
  method: `get`,
  route: `/invite/pending`,
  handler: async ({ response, respond }) => {
    const invites = await loopInvitePendingForUserList(getAuthenticatedUserId(response));
    respond({ status: 200, data: invites });
  },
});

route({
  method: `post`,
  route: `/invite/:invite/accept`,
  validators: {
    params: inviteParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const member = await loopInviteAccept(params.invite, getAuthenticatedUserId(response));
    respond({ status: 200, data: member });
  },
});

route({
  method: `post`,
  route: `/invite/:invite/reject`,
  validators: {
    params: inviteParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    await loopInviteReject(params.invite, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
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
  method: `get`,
  route: `/:loop/users`,
  validators: {
    params: loopParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const membership = await loopMembershipGet(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: membership });
  },
});

route({
  method: `post`,
  route: `/:loop/invite`,
  validators: {
    params: loopParamsSchema,
    body: loopInviteCreateSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const invite = await loopInviteCreate(params.loop, getAuthenticatedUserId(response), body);
    respond({ status: 201, data: invite });
  },
});

route({
  method: `delete`,
  route: `/:loop/invite/:invite`,
  validators: {
    params: loopInviteParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    await loopInviteRevoke(params.loop, params.invite, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

route({
  method: `put`,
  route: `/:loop/user/admin`,
  validators: {
    params: loopParamsSchema,
    body: loopUserAdminUpdateSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const member = await loopUserAdminUpdate(params.loop, getAuthenticatedUserId(response), body);
    respond({ status: 200, data: member });
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
  route: `/:loop/history-memory`,
  validators: { params: loopParamsSchema },
  handler: async ({ params, response, respond }) => {
    respond({ status: 200, data: await loopMemoryGet(params.loop, getAuthenticatedUserId(response)) });
  },
});

route({
  method: `put`,
  route: `/:loop/history-memory`,
  validators: { params: loopParamsSchema, body: loopMemoryConfigUpdateSchema },
  handler: async ({ params, body, response, respond }) => {
    respond({ status: 200, data: await loopMemoryUpdate(params.loop, getAuthenticatedUserId(response), body) });
  },
});

route({
  method: `get`,
  route: `/:loop/tools`,
  validators: {
    params: loopParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const tools = await loopToolsGet(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: tools });
  },
});

route({
  method: `put`,
  route: `/:loop/tools`,
  validators: {
    params: loopParamsSchema,
    body: loopToolsUpdateRequestSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const tools = await loopToolsUpdate(params.loop, getAuthenticatedUserId(response), body);
    respond({ status: 200, data: tools });
  },
});
