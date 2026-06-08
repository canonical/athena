import { authenticationRouter } from "@components/authentication/authentication.router.js";
import { requireAuthentication } from "@components/authentication/authentication-middleware.js";
import { defineMiddlewares } from "@components/base/define-middlewares.js";
import { config } from "@components/config/config.js";
import { statusRouter } from "@components/status/status.router.js";
import express, { type Request, type Response } from "express";

const app = express();
const host = config.application.host;
const port = config.application.port;

app.set(`trust proxy`, 1);
defineMiddlewares(app);

app.use(authenticationRouter);
app.use(statusRouter);

if (process.env.COVERAGE) {
  app.get(`/__coverage__`, (_request: Request, response: Response) => {
    response.json((globalThis as typeof globalThis & { __coverage__?: unknown }).__coverage__ ?? {});
  });
}

app.use(requireAuthentication);

app.listen(port, host, () => {
  console.log(`Athena server listening on http://${host}:${port}`);
});
