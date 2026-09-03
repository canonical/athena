import { getAuthenticatedUserId } from "@components/authentication/session.js";
import { defineRoutes } from "@components/express/express.router.js";
import { uuid } from "@components/utilities/zod.utilities.js";
import { Router } from "express";
import { z } from "zod";
import { ragIndexConfigure, ragIndexStateGet } from "./rag.controller.js";
import { ragIndexConfigureSchema } from "./rag.schema.js";

export const ragRouter = Router();
const route = defineRoutes(ragRouter);
const loopParamsSchema = z.object({ loop: uuid(`loop must be a valid UUID.`) });

route({
  method: `get`,
  route: `/loop/:loop`,
  validators: { params: loopParamsSchema },
  handler: async ({ params, response, respond }) => {
    respond({ status: 200, data: await ragIndexStateGet(params.loop, getAuthenticatedUserId(response)) });
  },
});

route({
  method: `put`,
  route: `/loop/:loop`,
  validators: { params: loopParamsSchema, body: ragIndexConfigureSchema },
  handler: async ({ params, body, response, respond }) => {
    respond({ status: 200, data: await ragIndexConfigure(params.loop, getAuthenticatedUserId(response), body) });
  },
});
