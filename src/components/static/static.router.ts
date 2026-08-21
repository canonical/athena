import { existsSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type RequestHandler, type Response, Router } from "express";

const apiRoot = `/api`;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontendDistPath = join(__dirname, `..`, `..`, `public`);
const frontendIndexPath = join(frontendDistPath, `index.html`);
const precompressedEncodings = [`br`, `gzip`] as const;

const isApiRequest = (request: Request): boolean => request.path === apiRoot || request.path.startsWith(`${apiRoot}/`);

const selectPrecompressedFile = (request: Request, filePath: string) => {
  const preferredEncoding = request.acceptsEncodings(...precompressedEncodings);
  if (preferredEncoding !== `br` && preferredEncoding !== `gzip`) {
    return undefined;
  }

  const encodings = [preferredEncoding, ...precompressedEncodings.filter((encoding) => encoding !== preferredEncoding)];
  const encoding = encodings.find((candidate) => request.acceptsEncodings(candidate) && existsSync(`${filePath}.${candidate}`));

  return encoding ? { encoding, filePath: `${filePath}.${encoding}` } : undefined;
};

const sendPrecompressedFile = (request: Request, response: Response, next: NextFunction, filePath: string, contentTypePath: string): boolean => {
  const selectedFile = selectPrecompressedFile(request, filePath);
  if (!selectedFile) {
    return false;
  }

  response.type(extname(contentTypePath));
  response.set(`Content-Encoding`, selectedFile.encoding);
  response.vary(`Accept-Encoding`);
  response.sendFile(selectedFile.filePath, (error) => {
    if (error) {
      next(error);
    }
  });

  return true;
};

export const precompressedStatic = (root: string): RequestHandler => {
  const staticMiddleware = express.static(root);
  const rootPath = resolve(root);

  return (request, response, next) => {
    if (request.method === `GET` || request.method === `HEAD`) {
      const requestedPath = resolve(rootPath, `.${request.path}`);
      const isInsideRoot = requestedPath === rootPath || requestedPath.startsWith(`${rootPath}${sep}`);

      if (isInsideRoot) {
        const isDirectoryRequest = request.path.endsWith(`/`);
        const requestedFilePath = isDirectoryRequest ? join(requestedPath, `index.html`) : requestedPath;
        const contentTypePath = isDirectoryRequest ? `index.html` : request.path;

        if (sendPrecompressedFile(request, response, next, requestedFilePath, contentTypePath)) {
          return;
        }
      }
    }

    staticMiddleware(request, response, next);
  };
};

export const staticRouter = Router();

const frontendStatic = precompressedStatic(frontendDistPath);

staticRouter.use((request: Request, response: Response, next: NextFunction) => {
  if (isApiRequest(request)) {
    next();
    return;
  }

  frontendStatic(request, response, next);
});

staticRouter.use((request: Request, response: Response, next: NextFunction) => {
  if (isApiRequest(request) || (request.method !== `GET` && request.method !== `HEAD`)) {
    next();
    return;
  }

  if (!existsSync(frontendIndexPath)) {
    response.status(503).send(`Frontend bundle not built yet.`);
    return;
  }

  if (!sendPrecompressedFile(request, response, next, frontendIndexPath, `index.html`)) {
    response.sendFile(frontendIndexPath);
  }
});
