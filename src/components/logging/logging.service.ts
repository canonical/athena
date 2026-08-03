import type { Express, Request } from "express";
import pinoHttp, { type Options as PinoHttpOptions } from "pino-http";
import type { AppLogger, TracedRequest } from "./logging.schema.js";
import { normalizeHeaderName, resolveTraceContext, TRACEPARENT_HEADER_NAME } from "./logging.trace.js";

type RegisterLoggingOptions = {
  headerName?: string;
  serviceName: string;
  level?: string;
  enabled?: boolean;
  pino?: PinoHttpOptions;
};

type GenReqIdParameters = Parameters<NonNullable<PinoHttpOptions["genReqId"]>>;
type CustomPropsParameters = Parameters<NonNullable<PinoHttpOptions["customProps"]>>;
type CustomLogLevelParameters = Parameters<NonNullable<PinoHttpOptions["customLogLevel"]>>;

const isHealthCheckRequest = (request: CustomLogLevelParameters[0]): boolean => {
  const requestUrl = typeof request.url === `string` ? request.url : ``;

  return requestUrl === `/_status/check` || requestUrl.startsWith(`/_status/check?`);
};

const writeConsole = (level: `info` | `warn` | `error`, message: string, context?: Record<string, unknown>): void => {
  if (!context) {
    console[level](message);
    return;
  }

  console[level](message, context);
};

export const log: AppLogger = {
  info: (message, context) => {
    writeConsole(`info`, message, context);
  },
  warn: (message, context) => {
    writeConsole(`warn`, message, context);
  },
  error: (message, context) => {
    writeConsole(`error`, message, context);
  },
};

export const resolveRequestLogger = (request: Request): AppLogger => {
  const tracedRequest = request as TracedRequest;

  const logInfo = tracedRequest.log?.info?.bind(tracedRequest.log);
  const logWarn = tracedRequest.log?.warn?.bind(tracedRequest.log);
  const logError = tracedRequest.log?.error?.bind(tracedRequest.log);

  if (!logInfo || !logWarn || !logError) {
    return log;
  }

  return {
    info: (message, context) => {
      if (context) {
        logInfo(context, message);
        return;
      }

      logInfo(message);
    },
    warn: (message, context) => {
      if (context) {
        logWarn(context, message);
        return;
      }

      logWarn(message);
    },
    error: (message, context) => {
      if (context) {
        logError(context, message);
        return;
      }

      logError(message);
    },
  };
};

export const registerLogging = (app: Express, options: RegisterLoggingOptions): void => {
  const enabled = options.enabled ?? true;

  if (!enabled) {
    return;
  }

  const headerName = options.headerName ?? TRACEPARENT_HEADER_NAME;
  const { configured } = normalizeHeaderName(headerName);
  const level = options.level?.trim() || `info`;

  app.use((request, response, next) => {
    const trace = resolveTraceContext(request, configured);
    const tracedRequest = request as TracedRequest;

    tracedRequest.traceId = trace.traceId;
    tracedRequest.spanId = trace.spanId;
    tracedRequest.traceparent = trace.traceparent;

    response.locals.traceId = trace.traceId;
    response.locals.spanId = trace.spanId;
    response.locals.traceparent = trace.traceparent;

    response.setHeader(configured, trace.traceparent);
    response.setHeader(`trace-id`, trace.traceId);

    next();
  });

  const pinoFactoryCandidate: unknown = pinoHttp;
  const pinoFactory = typeof pinoFactoryCandidate === `function` ? pinoFactoryCandidate : (pinoFactoryCandidate as { default?: unknown }).default;

  if (typeof pinoFactory !== `function`) {
    throw new Error(`pino-http factory is not available.`);
  }

  app.use(
    pinoFactory({
      level,
      quietReqLogger: true,
      ...options.pino,
      customLogLevel: (request: CustomLogLevelParameters[0], response: CustomLogLevelParameters[1], error: CustomLogLevelParameters[2]) => {
        if (isHealthCheckRequest(request)) {
          return `silent`;
        }

        const tracedRequest = request as TracedRequest;

        if (tracedRequest.loggedUnhandledError && (Boolean(error) || response.statusCode >= 500)) {
          return `silent`;
        }

        if (error || response.statusCode >= 500) {
          return `error`;
        }

        if (response.statusCode >= 400) {
          return `warn`;
        }

        return `info`;
      },
      genReqId: (request: GenReqIdParameters[0], response: GenReqIdParameters[1]) => {
        const tracedRequest = request as TracedRequest;

        if (tracedRequest.traceId) {
          return tracedRequest.traceId;
        }

        const generated = resolveTraceContext(request, configured);
        tracedRequest.traceId = generated.traceId;
        tracedRequest.spanId = generated.spanId;
        tracedRequest.traceparent = generated.traceparent;
        response.setHeader(configured, generated.traceparent);
        response.setHeader(`trace-id`, generated.traceId);

        return generated.traceId;
      },
      customProps: (request: CustomPropsParameters[0]) => {
        const tracedRequest = request as TracedRequest;

        return {
          service: options.serviceName,
          traceId: tracedRequest.traceId,
          spanId: tracedRequest.spanId,
        };
      },
      redact: {
        paths: [`req.headers.authorization`, `req.headers.cookie`, `res.headers.set-cookie`],
        remove: true,
      },
    }),
  );
};
