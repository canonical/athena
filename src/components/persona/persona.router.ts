import { getAuthenticatedUserId } from "@components/authentication/session.js";
import { defineRoutes } from "@components/express/express.router.js";
import { uuid } from "@components/utilities/zod.utilities.js";
import { Router } from "express";
import { z } from "zod";
import { personaAssignToLoop, personaCatalog, personaCreate, personaDelete, personaGetById, personaListForLoop, personaListForUser, personaUnassign, personaUpdateGlobal } from "./persona.controller.js";
import { personaWritableSchema } from "./persona.schema.js";

export const personaRouter = Router();
const route = defineRoutes(personaRouter);

const loopParamsSchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
});

const personaParamsSchema = z.object({
  persona: uuid(`persona must be a valid UUID.`),
});

const personaAssignBodySchema = z.object({
  loop: uuid(`loop must be a valid UUID.`),
  persona: uuid(`persona must be a valid UUID.`),
});

const personaDeleteBodySchema = z.object({
  persona: uuid(`persona must be a valid UUID.`),
});

route({
  method: `get`,
  route: `/catalog`,
  handler: async ({ respond }) => {
    const catalog = await personaCatalog();
    respond({ status: 200, data: catalog });
  },
});

route({
  method: `get`,
  route: `/`,
  handler: async ({ response, respond }) => {
    const personas = await personaListForUser(getAuthenticatedUserId(response));
    respond({ status: 200, data: personas });
  },
});

route({
  method: `post`,
  route: `/`,
  validators: { body: personaWritableSchema },
  handler: async ({ body, response, respond }) => {
    const persona = await personaCreate(body, getAuthenticatedUserId(response));
    respond({ status: 201, data: persona });
  },
});

route({
  method: `delete`,
  route: `/`,
  validators: { body: personaDeleteBodySchema },
  handler: async ({ body, response, respond }) => {
    await personaDelete(body.persona, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

route({
  method: `post`,
  route: `/assign`,
  validators: {
    body: personaAssignBodySchema,
  },
  handler: async ({ body, response, respond }) => {
    await personaAssignToLoop(body.loop, body.persona, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

route({
  method: `delete`,
  route: `/unassign`,
  validators: {
    body: personaAssignBodySchema,
  },
  handler: async ({ body, response, respond }) => {
    await personaUnassign(body.loop, body.persona, getAuthenticatedUserId(response));
    respond({ status: 204 });
  },
});

route({
  method: `get`,
  route: `/:persona`,
  validators: {
    params: personaParamsSchema,
  },
  handler: async ({ params, respond }) => {
    const persona = await personaGetById(params.persona);
    respond({ status: 200, data: persona });
  },
});

route({
  method: `put`,
  route: `/:persona`,
  validators: {
    params: personaParamsSchema,
    body: personaWritableSchema,
  },
  handler: async ({ params, body, response, respond }) => {
    const persona = await personaUpdateGlobal(params.persona, body, getAuthenticatedUserId(response));
    respond({ status: 200, data: persona });
  },
});

route({
  method: `get`,
  route: `/loop/:loop/list`,
  validators: {
    params: loopParamsSchema,
  },
  handler: async ({ params, response, respond }) => {
    const personas = await personaListForLoop(params.loop, getAuthenticatedUserId(response));
    respond({ status: 200, data: personas });
  },
});
