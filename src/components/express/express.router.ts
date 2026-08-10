import type express from "express";
import type { z } from "zod";
import { isHttpErrorShape } from "./express.errors.js";
import type { DefineRoutesOptions, RouteOptions, RouteRespondOptions, ValidatedHandler, ValidatedResponseLocals, ValidateOptions, ValidationTarget } from "./express.schema.js";

const toIssueDetails = (error: z.ZodError) => {
  return error.issues.map((issue) => ({
    path: issue.path.map((part) => String(part)).join(`.`),
    message: issue.message,
  }));
};

const sendValidationError = (response: express.Response, target: ValidationTarget, error: z.ZodError): void => {
  const fallbackMessage = target === `body` ? `Invalid request body.` : target === `query` ? `Invalid request query.` : `Invalid request params.`;

  response.status(400).json({
    error: error.issues[0]?.message ?? fallbackMessage,
    target,
    details: toIssueDetails(error),
  });
};

export function validate<BodySchema extends z.ZodType | undefined, QuerySchema extends z.ZodType | undefined, ParamsSchema extends z.ZodType | undefined>(options: {
  body?: BodySchema;
  query?: QuerySchema;
  params?: ParamsSchema;
}): express.RequestHandler;

export function validate<BodySchema extends z.ZodType | undefined, QuerySchema extends z.ZodType | undefined, ParamsSchema extends z.ZodType | undefined>(
  options: {
    body?: BodySchema;
    query?: QuerySchema;
    params?: ParamsSchema;
  },
  handler: ValidatedHandler<BodySchema, QuerySchema, ParamsSchema>,
): express.RequestHandler;

export function validate({ body, query, params }: ValidateOptions, handler?: ValidatedHandler<z.ZodType | undefined, z.ZodType | undefined, z.ZodType | undefined>): express.RequestHandler {
  return (request, response, next) => {
    const locals = response.locals as ValidatedResponseLocals<z.ZodType | undefined, z.ZodType | undefined, z.ZodType | undefined>;
    locals.validated ??= {};

    if (body) {
      const parsedBody = body.safeParse(request.body);

      if (!parsedBody.success) {
        sendValidationError(response, `body`, parsedBody.error);
        return;
      }

      request.body = parsedBody.data as typeof request.body;
      locals.validated.body = parsedBody.data;
    }

    if (query) {
      const parsedQuery = query.safeParse(request.query);

      if (!parsedQuery.success) {
        sendValidationError(response, `query`, parsedQuery.error);
        return;
      }

      locals.validated.query = parsedQuery.data;
    }

    if (params) {
      const parsedParams = params.safeParse(request.params);

      if (!parsedParams.success) {
        sendValidationError(response, `params`, parsedParams.error);
        return;
      }

      request.params = parsedParams.data as typeof request.params;
      locals.validated.params = parsedParams.data;
    }

    if (!handler) {
      next();
      return;
    }

    const typedResponse = response as express.Response<unknown, ValidatedResponseLocals<z.ZodType | undefined, z.ZodType | undefined, z.ZodType | undefined>>;
    Promise.resolve(handler(request, typedResponse, next)).catch(next);
  };
}

export const route = <BodySchema extends z.ZodType | undefined, QuerySchema extends z.ZodType | undefined, ParamsSchema extends z.ZodType | undefined>(
  router: express.Router,
  { method, route: routePath, validators, handler, onError }: RouteOptions<BodySchema, QuerySchema, ParamsSchema>,
): void => {
  const registerHandler = validate(
    {
      body: validators?.body,
      query: validators?.query,
      params: validators?.params,
    },
    async (request, response, next) => {
      const locals = response.locals as ValidatedResponseLocals<BodySchema, QuerySchema, ParamsSchema>;

      const respond = <Data>({ status, data }: RouteRespondOptions<Data>): void => {
        if (status === 204) {
          response.sendStatus(204);
          return;
        }

        response.status(status).json(data);
      };

      const fail = ({ status, message, details }: { status: number; message: string; details?: unknown }): void => {
        response.status(status).json(details === undefined ? { error: message } : { error: message, details });
      };

      const context = {
        body: locals.validated?.body as BodySchema extends z.ZodType ? z.infer<BodySchema> : unknown,
        query: locals.validated?.query as QuerySchema extends z.ZodType ? z.infer<QuerySchema> : unknown,
        params: locals.validated?.params as ParamsSchema extends z.ZodType ? z.infer<ParamsSchema> : unknown,
        request,
        response,
        next,
        respond,
        fail,
      };

      try {
        await handler(context);
      } catch (error) {
        if (isHttpErrorShape(error)) {
          fail({
            status: error.status,
            message: error.message,
            details: error.details,
          });
          return;
        }

        if (onError && (await onError({ ...context, error }))) {
          return;
        }

        throw error;
      }
    },
  );

  router[method](routePath, registerHandler);
};

export const defineRoutes = (router: express.Router, defaults?: DefineRoutesOptions) => {
  return <BodySchema extends z.ZodType | undefined, QuerySchema extends z.ZodType | undefined, ParamsSchema extends z.ZodType | undefined>(options: RouteOptions<BodySchema, QuerySchema, ParamsSchema>) => {
    route(router, {
      ...options,
      onError: options.onError ?? defaults?.onError,
    });
  };
};
