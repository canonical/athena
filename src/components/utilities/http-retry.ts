import { delay } from "@components/utilities/timers.js";

type FetchRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  retryableStatuses?: number[];
  allowRetryOnNonIdempotentMethods?: boolean;
};

const defaultRetryableStatuses = new Set([429, 502, 503, 504]);

const parseRetryAfterMs = (headerValue: string | null): number | null => {
  if (!headerValue) {
    return null;
  }

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const timestamp = Date.parse(headerValue);
  if (!Number.isNaN(timestamp)) {
    const deltaMs = timestamp - Date.now();
    return deltaMs > 0 ? deltaMs : 0;
  }

  return null;
};

const computeBackoffMs = (attempt: number, baseDelayMs: number, maxDelayMs: number, jitterRatio: number): number => {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
  const minMultiplier = Math.max(0, 1 - jitterRatio);
  const maxMultiplier = 1 + Math.max(0, jitterRatio);
  const jitter = minMultiplier + (maxMultiplier - minMultiplier) * Math.random();
  return Math.max(0, Math.round(exponential * jitter));
};

const isRetryableMethod = (method: string, allowRetryOnNonIdempotentMethods: boolean): boolean => {
  if (allowRetryOnNonIdempotentMethods) {
    return true;
  }

  return method === "GET" || method === "HEAD" || method === "OPTIONS" || method === "PUT" || method === "DELETE";
};

const isRetryableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  // Node fetch transient network errors typically surface as TypeError.
  if (error.name === "TypeError") {
    return true;
  }

  // AbortError can represent transient upstream cancellation; callers can opt out by signal abortion.
  if (error.name === "AbortError") {
    return true;
  }

  return false;
};

export const fetchWithRetry = async (input: string | URL | Request, init?: RequestInit, options?: FetchRetryOptions): Promise<Response> => {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, options?.baseDelayMs ?? 400);
  const maxDelayMs = Math.max(baseDelayMs, options?.maxDelayMs ?? 10_000);
  const jitterRatio = options?.jitterRatio ?? 0.2;
  const retryableStatuses = new Set(options?.retryableStatuses ?? Array.from(defaultRetryableStatuses));
  const allowRetryOnNonIdempotentMethods = options?.allowRetryOnNonIdempotentMethods ?? false;
  const method = (init?.method ?? "GET").toUpperCase();
  const signal = init?.signal;

  const canRetryMethod = isRetryableMethod(method, allowRetryOnNonIdempotentMethods);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input, init);

      if (!canRetryMethod || !retryableStatuses.has(response.status) || attempt >= maxAttempts) {
        return response;
      }

      const retryAfterMs = parseRetryAfterMs(response.headers.get("Retry-After"));
      const delayMs = retryAfterMs ?? computeBackoffMs(attempt, baseDelayMs, maxDelayMs, jitterRatio);
      await delay(delayMs);
    } catch (error) {
      if (!canRetryMethod || !isRetryableError(error) || attempt >= maxAttempts || signal?.aborted) {
        throw error;
      }

      const delayMs = computeBackoffMs(attempt, baseDelayMs, maxDelayMs, jitterRatio);
      await delay(delayMs);
    }
  }

  throw new Error("Unreachable fetch retry state.");
};
