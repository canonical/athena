import { defineRoutes } from "@components/express/express.router.js";
import { Router } from "express";

export const statusRouter = Router();
const route = defineRoutes(statusRouter);

const statusResponsePayload = {
  status: `ok`,
  whoami: `athena`,
};

route({
  method: `get`,
  route: `/_status/check`,
  handler: async ({ respond }) => {
    respond({ status: 200, data: statusResponsePayload });
  },
});

route({
  method: `get`,
  route: `/_status/ping`,
  handler: async ({ respond }) => {
    respond({ status: 200, data: statusResponsePayload });
  },
});
