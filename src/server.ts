import { authenticationRouter } from "@components/authentication/authentication.router.js";
import { requireAuthentication } from "@components/authentication/authentication-middleware.js";
import { defineMiddlewares } from "@components/base/define-middlewares.js";
import { config } from "@components/config/config.js";
import { defineLoggingErrorHandler } from "@components/logging/logging.middleware.js";
import { log } from "@components/logging/logging.service.js";
import { loopRouter } from "@components/loop/loop.router.js";
import { personaRouter } from "@components/persona/persona.router.js";
import { providerRouter } from "@components/provider/provider.router.js";
import { repositoryRouter } from "@components/repository/repository.router.js";
import { runnerRouter } from "@components/runner/runner.router.js";
import { staticRouter } from "@components/static/static.router.js";
import { statusRouter } from "@components/status/status.router.js";
import { startTaskProcessor } from "@components/task/task.processor.js";
import { taskRouter } from "@components/task/task.router.js";
import { webhookPublicRouter } from "@components/webhook/webhook.public.router.js";
import { webhookRouter } from "@components/webhook/webhook.router.js";
import { startWebhookItemProcessor } from "@components/webhook/webhook.processor.js";
import { workgraphRouter } from "@components/workgraph/workgraph.router.js";
import express, { type Request, type Response } from "express";

const app = express();
const port = config.application.port;
const apiRoot = `/api`;

app.set(`trust proxy`, 1);
defineMiddlewares(app);

app.use(`${apiRoot}/authentication`, authenticationRouter);
app.use(statusRouter);
app.use(`${apiRoot}/webhook`, webhookPublicRouter);

if (process.env.COVERAGE) {
  app.get(`${apiRoot}/__coverage__`, (_request: Request, response: Response) => {
    response.json((globalThis as typeof globalThis & { __coverage__?: unknown }).__coverage__ ?? {});
  });
}

app.use(apiRoot, requireAuthentication);
app.use(`${apiRoot}/task`, taskRouter);
app.use(`${apiRoot}/loop`, loopRouter);
app.use(`${apiRoot}/persona`, personaRouter);
app.use(`${apiRoot}/runner`, runnerRouter);
app.use(`${apiRoot}/provider`, providerRouter);
app.use(`${apiRoot}/repository`, repositoryRouter);
app.use(`${apiRoot}/workgraph`, workgraphRouter);
app.use(`${apiRoot}/webhook`, webhookRouter);
app.use(staticRouter);

app.use((_request: Request, response: Response) => {
  response.sendStatus(404);
});

defineLoggingErrorHandler(app);

app.listen(port, () => {
  log.info(`Athena server listening on port ${port}`);

  startTaskProcessor({
    intervalMs: 1500,
    poolReadinessIntervalMs: 60_000,
  });

  startWebhookItemProcessor();
});
