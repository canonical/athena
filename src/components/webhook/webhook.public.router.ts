import { defineRoutes } from "@components/express/express.router.js";
import { Router } from "express";
import { z } from "zod";
import { webhookInboundReceive } from "./webhook.controller.js";

export const webhookPublicRouter = Router();
const route = defineRoutes(webhookPublicRouter);

const inboundWebhookParamsSchema = z.object({
  receiverId: z.string().min(1, `receiverId is required.`),
});

route({
  method: `post`,
  route: `/inbound/:receiverId`,
  validators: {
    params: inboundWebhookParamsSchema,
  },
  handler: async ({ params, request, respond }) => {
    await webhookInboundReceive(params.receiverId, request.headers, request.body);
    respond({ status: 200, data: { ok: true } });
  },
});
