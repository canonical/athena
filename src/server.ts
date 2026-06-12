import { authenticationRouter } from "@components/authentication/authentication.router.js";
import { requireAuthentication } from "@components/authentication/authentication-middleware.js";
import { defineMiddlewares } from "@components/base/define-middlewares.js";
import { config } from "@components/config/config.js";
import { loopRouter } from "@components/loop/loop.router.js";
import { projectRouter } from "@components/project/project.router.js";
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
app.use(apiRoot, projectRouter);
app.use(apiRoot, loopRouter);
app.use(staticRouter);

app.use((_request: Request, response: Response) => {
  response.sendStatus(404);
});

app.listen(port, () => {
  console.log(`Athena server listening on port ${port}`);
});
