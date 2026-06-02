import { bootstrap } from "@components/bootstrap/bootstrap.service.js";
import { config } from "@components/config/config.js";
import { getEnvironmentSnapshot } from "@components/environment/environment.service.js";
import express, { type Request, type Response } from "express";

const app = express();
const host = config.app.host;
const port = config.app.port;
const root = config.app.root;

app.use(express.json());

app.get(`/health`, (_request: Request, response: Response) => {
  response.json({
    service: `athena`,
    status: `ok`,
    port,
  });
});

app.get(`/environment`, async (_request: Request, response: Response) => {
  const snapshot = await getEnvironmentSnapshot();

  response.json(snapshot);
});

app.post(`/route`, (request: Request, response: Response) => {
  response.json({
    decision: `noop`,
    escalate: false,
    received: request.body ?? null,
  });
});

app.listen(port, host, () => {
  console.log(`Athena server listening on http://${host}:${port}${root}`);
  console.log(`Environment initiation is still in progress, please wait...`);
});

try {
  await bootstrap();
} catch (error: unknown) {
  console.error(`Failed to bootstrap Athena`, error);
}
