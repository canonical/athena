import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response, Router } from "express";

const apiRoot = `/api`;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontendDistPath = join(__dirname, `..`, `..`, `public`);
const frontendIndexPath = join(frontendDistPath, `index.html`);

export const staticRouter = Router();

staticRouter.use(express.static(frontendDistPath));

staticRouter.use((request: Request, response: Response, next: NextFunction) => {
  if (request.path.startsWith(apiRoot) || request.method !== `GET`) {
    next();
    return;
  }

  if (!existsSync(frontendIndexPath)) {
    response.status(503).send(`Frontend bundle not built yet.`);
    return;
  }

  response.sendFile(frontendIndexPath);
});
