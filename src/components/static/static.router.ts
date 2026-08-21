import { existsSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type RequestHandler, type Response, Router } from "express";

const apiRoot = `/api`;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontendDistPath = join(__dirname, `..`, `..`, `public`);
const frontendIndexPath = join(frontendDistPath, `index.html`);
const precompressedEncodings = [`br`, `gzip`] as const;

const isApiRequest = (request: Request): boolean => request.path === apiRoot || request.path.startsWith(`${apiRoot}/`);
const isWithinRoot = (rootPath: string, filePath: string): boolean => filePath === rootPath || filePath.startsWith(`${rootPath}${sep}`);

const selectPrecompressedFile = (request: Request, rootPath: string, requestedPath: string) => {
  if (!isWithinRoot(rootPath, resolve(rootPath, `.${requestedPath}`))) {
    return undefined;
  }

  const preferredEncoding = request.acceptsEncodings(...precompressedEncodings);
  if (preferredEncoding !== `br` && preferredEncoding !== `gzip`) {
    return undefined;
  }

  const encodings = [preferredEncoding, ...precompressedEncodings.filter((encoding) => encoding !== preferredEncoding)];
  const selectedFile = encodings
    .map((candidate) => ({
      candidate,
      filePath: resolve(rootPath, `.${requestedPath}.${candidate}`),
    }))
    .find(({ candidate, filePath }) => request.acceptsEncodings(candidate) && isWithinRoot(rootPath, filePath) && existsSync(filePath));

  return selectedFile
    ? {
        encoding: selectedFile.candidate,
        relativePath: relative(rootPath, selectedFile.filePath),
      }
    : undefined;
};

const sendPrecompressedFile = (request: Request, response: Response, next: NextFunction, rootPath: string, requestedPath: string, contentTypePath: string): boolean => {
  const selectedFile = selectPrecompressedFile(request, rootPath, requestedPath);
  if (!selectedFile) {
    return false;
  }

  response.type(extname(contentTypePath));
  response.set(`Content-Encoding`, selectedFile.encoding);
  response.vary(`Accept-Encoding`);
  response.sendFile(selectedFile.relativePath, { root: rootPath }, (error) => {
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
      const isDirectoryRequest = request.path.endsWith(`/`);
      const requestedPath = isDirectoryRequest ? `${request.path}index.html` : request.path;
      const contentTypePath = isDirectoryRequest ? `index.html` : request.path;

      if (isWithinRoot(rootPath, resolve(rootPath, `.${requestedPath}`)) && sendPrecompressedFile(request, response, next, rootPath, requestedPath, contentTypePath)) {
        return;
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

  if (!sendPrecompressedFile(request, response, next, frontendDistPath, `/index.html`, `index.html`)) {
    response.sendFile(frontendIndexPath);
  }
});
