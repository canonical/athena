import type express from "express";
import type { z } from "zod";

export type ValidationTarget = `body` | `query` | `params`;

export type InferValidatedValue<Schema extends z.ZodType | undefined> = Schema extends z.ZodType ? z.infer<Schema> : unknown;

export type ValidatedResponseLocals<BodySchema extends z.ZodType | undefined, QuerySchema extends z.ZodType | undefined, ParamsSchema extends z.ZodType | undefined> = {
  validated?: {
    body?: InferValidatedValue<BodySchema>;
    query?: InferValidatedValue<QuerySchema>;
    params?: InferValidatedValue<ParamsSchema>;
  };
};

export type ValidatedHandler<BodySchema extends z.ZodType | undefined, QuerySchema extends z.ZodType | undefined, ParamsSchema extends z.ZodType | undefined> = (
  request: express.Request,
  response: express.Response<unknown, ValidatedResponseLocals<BodySchema, QuerySchema, ParamsSchema>>,
  next: express.NextFunction,
) => unknown;

export type RouteMethod = `delete` | `get` | `patch` | `post` | `put`;

export type RouteFailOptions = {
  status: number;
  message: string;
  details?: unknown;
};

export type RouteRespondOptions<Data> = {
  status: number;
  data?: Data;
};

export type RouteContext<BodySchema extends z.ZodType | undefined, QuerySchema extends z.ZodType | undefined, ParamsSchema extends z.ZodType | undefined> = {
  body: InferValidatedValue<BodySchema>;
  query: InferValidatedValue<QuerySchema>;
  params: InferValidatedValue<ParamsSchema>;
  request: express.Request;
  response: express.Response;
  next: express.NextFunction;
  respond: <Data>(options: RouteRespondOptions<Data>) => void;
  fail: (options: RouteFailOptions) => void;
};

export type RouteErrorContext<BodySchema extends z.ZodType | undefined, QuerySchema extends z.ZodType | undefined, ParamsSchema extends z.ZodType | undefined> = RouteContext<BodySchema, QuerySchema, ParamsSchema> & {
  error: unknown;
};

export type RouteErrorHandler<BodySchema extends z.ZodType | undefined, QuerySchema extends z.ZodType | undefined, ParamsSchema extends z.ZodType | undefined> = (
  context: RouteErrorContext<BodySchema, QuerySchema, ParamsSchema>,
) => boolean | Promise<boolean>;

export type RouteOptions<BodySchema extends z.ZodType | undefined, QuerySchema extends z.ZodType | undefined, ParamsSchema extends z.ZodType | undefined> = {
  method: RouteMethod;
  route: string;
  validators?: {
    body?: BodySchema;
    query?: QuerySchema;
    params?: ParamsSchema;
  };
  handler: (context: RouteContext<BodySchema, QuerySchema, ParamsSchema>) => unknown;
  onError?: RouteErrorHandler<BodySchema, QuerySchema, ParamsSchema>;
};

export type DefineRoutesOptions = {
  onError?: RouteErrorHandler<z.ZodType | undefined, z.ZodType | undefined, z.ZodType | undefined>;
};

export type ValidateOptions = {
  body?: z.ZodType | undefined;
  query?: z.ZodType | undefined;
  params?: z.ZodType | undefined;
};
