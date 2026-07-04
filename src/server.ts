import { authenticationRouter } from "@components/authentication/authentication.router.js";
import { requireAuthentication } from "@components/authentication/authentication-middleware.js";
import { defineMiddlewares } from "@components/base/define-middlewares.js";
import { config } from "@components/config/config.js";
import { eventRouter } from "@components/event/event.router.js";
import { harnessRouter } from "@components/harness/harness.router.js";
import { loopRouter } from "@components/loop/loop.router.js";
import { personaRouter } from "@components/persona/persona.router.js";
import { providerRouter } from "@components/provider/provider.router.js";
import { runnerRouter } from "@components/runner/runner.router.js";
import { staticRouter } from "@components/static/static.router.js";
import { statusRouter } from "@components/status/status.router.js";
import express, { type Request, type Response } from "express";

const app = express();
const port = config.application.port;
const apiRoot = `/api`;

app.set(`trust proxy`, 1);
defineMiddlewares(app);

app.use(apiRoot, authenticationRouter);
app.use(statusRouter);

if (process.env.COVERAGE) {
  app.get(`${apiRoot}/__coverage__`, (_request: Request, response: Response) => {
    response.json((globalThis as typeof globalThis & { __coverage__?: unknown }).__coverage__ ?? {});
  });
}

app.use(apiRoot, requireAuthentication);
app.use(apiRoot, eventRouter);
app.use(apiRoot, loopRouter);
app.use(apiRoot, personaRouter);
app.use(apiRoot, harnessRouter);
app.use(apiRoot, providerRouter);
app.use(apiRoot, runnerRouter);
app.use(staticRouter);

app.use((_request: Request, response: Response) => {
  response.sendStatus(404);
});

app.listen(port, () => {
  console.log(`Athena server listening on port ${port}`);
});
