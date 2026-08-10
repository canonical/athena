import type { Request } from "express";

export type TraceSource = `header` | `generated`;

export type TraceContext = {
  traceId: string;
  spanId: string;
  traceparent: string;
  source: TraceSource;
};

export type TracedRequest = Request & {
  traceId?: string;
  spanId?: string;
  traceparent?: string;
  loggedUnhandledError?: boolean;
  log?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
};

export type AppLogger = {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
};
