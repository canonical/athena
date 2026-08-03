import { randomBytes } from "node:crypto";
import type { TraceContext } from "./logging.schema.js";

type HeaderCarrier = {
  headers?: Record<string, string | string[] | undefined>;
};

const TRACEPARENT_PATTERN = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export const TRACEPARENT_HEADER_NAME = `traceparent`;

export const normalizeHeaderName = (headerName: string): { configured: string; normalized: string } => {
  const configured = headerName.trim();

  if (!configured) {
    throw new Error(`Trace header name must not be empty.`);
  }

  return { configured, normalized: configured.toLowerCase() };
};

const generateHex = (length: number): string =>
  randomBytes(Math.ceil(length / 2))
    .toString(`hex`)
    .slice(0, length);

export const generateTraceparent = (): { traceId: string; spanId: string; traceparent: string } => {
  const traceId = generateHex(32);
  const spanId = generateHex(16);
  const traceparent = `00-${traceId}-${spanId}-01`;

  return { traceId, spanId, traceparent };
};

const parseTraceparent = (rawValue: string): { traceId: string; spanId: string } | undefined => {
  const match = TRACEPARENT_PATTERN.exec(rawValue.trim().toLowerCase());

  if (!match) {
    return undefined;
  }

  const [, traceId, spanId] = match;
  return { traceId, spanId };
};

export const readTraceHeader = (request: HeaderCarrier, headerName: string): string | undefined => {
  const { normalized } = normalizeHeaderName(headerName);

  const entries = Object.entries(request.headers ?? {});

  for (const [headerKey, headerValue] of entries) {
    if (headerKey.toLowerCase() !== normalized) {
      continue;
    }

    if (typeof headerValue === `string`) {
      return headerValue;
    }

    if (Array.isArray(headerValue)) {
      const first = headerValue.find((value) => typeof value === `string` && value.trim().length > 0);
      return first;
    }
  }

  return undefined;
};

export const resolveTraceContext = (request: HeaderCarrier, headerName: string): TraceContext => {
  const incoming = readTraceHeader(request, headerName);

  if (incoming) {
    const parsed = parseTraceparent(incoming);

    if (parsed) {
      return {
        traceId: parsed.traceId,
        spanId: parsed.spanId,
        traceparent: `00-${parsed.traceId}-${parsed.spanId}-01`,
        source: `header`,
      };
    }
  }

  const generated = generateTraceparent();

  return {
    traceId: generated.traceId,
    spanId: generated.spanId,
    traceparent: generated.traceparent,
    source: `generated`,
  };
};

export const createTraceForwardedHeadersResolver = (headerName: string) => {
  const { configured } = normalizeHeaderName(headerName);

  return (request: HeaderCarrier): Record<string, string> | undefined => {
    const traceHeader = readTraceHeader(request, configured);

    if (!traceHeader) {
      return undefined;
    }

    return { [configured]: traceHeader };
  };
};
