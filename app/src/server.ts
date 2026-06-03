import { config } from "@components/config/config.js";
import express, { type Request, type Response } from "express";

const app = express();
const host = config.app.host;
const port = config.app.port;

app.get(`/_status/check`, (_request: Request, response: Response) => {
  response.json({
    status: `ok`,
    whoami: `athena`,
  });
});

app.listen(port, host, () => {
  console.log(`Athena server listening on http://${host}:${port}`);
});
