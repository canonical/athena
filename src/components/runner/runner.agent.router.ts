import { defineRoutes } from "@components/express/express.router.js";
import { Router } from "express";
import { runnerAgentConnect } from "./runner.controller.js";
import { RunnerAuthenticationError } from "./runner.errors.js";
import { runnerAgentConnectSchema, runnerAgentHeartbeatSchema } from "./runner.schema.js";

export const runnerAgentRouter = Router();
const route = defineRoutes(runnerAgentRouter);

const getBearerToken = (authorization: string | undefined): string => {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new RunnerAuthenticationError();
  return match[1];
};

route({
  method: `post`,
  route: `/connect`,
  validators: { body: runnerAgentConnectSchema },
  handler: async ({ body, request, respond }) => {
    const instance = await runnerAgentConnect(getBearerToken(request.header(`authorization`)), body);
    if (!instance) throw new RunnerAuthenticationError();
    respond({ status: 200, data: instance });
  },
});

route({
  method: `post`,
  route: `/heartbeat`,
  validators: { body: runnerAgentHeartbeatSchema },
  handler: async ({ body, request, respond }) => {
    const instance = await runnerAgentConnect(getBearerToken(request.header(`authorization`)), {
      ...body,
      name: body.instanceId,
    });
    if (!instance) throw new RunnerAuthenticationError();
    respond({ status: 200, data: instance });
  },
});
