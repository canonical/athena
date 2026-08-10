import type { ErrorRequestHandler, Express } from "express";
import type { TracedRequest } from "./logging.schema.js";
import { resolveRequestLogger } from "./logging.service.js";

export const unhandledRequestErrorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  (request as TracedRequest).loggedUnhandledError = true;
  const logger = resolveRequestLogger(request);

  logger.error(`Unhandled request error`, {
    traceId: response.locals.traceId,
    path: request.originalUrl,
    method: request.method,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
  });

  if (response.headersSent) {
    return;
  }

  response.status(500).json({ error: `Internal server error.` });
};

export const defineLoggingErrorHandler = (app: Express): void => {
  app.use(unhandledRequestErrorHandler);
};
