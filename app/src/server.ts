import { config } from "@components/config/config.js";
import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const host = config.app.host;
const port = config.app.port;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "./public");

app.use(express.static(publicDir));

app.get(`/`, (_request: Request, response: Response) => {
  response.sendFile(path.join(publicDir, `index.html`));
});

app.get(`/_status/check`, (_request: Request, response: Response) => {
  response.json({
    status: `ok`,
    whoami: `athena`,
  });
});

app.listen(port, host, () => {
  console.log(`Athena server listening on http://${host}:${port}`);
});
