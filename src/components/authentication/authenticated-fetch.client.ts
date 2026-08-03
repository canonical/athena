import { UnauthenticatedError } from "./authentication.errors.js";

type AuthenticatedRequestInit = Omit<RequestInit, "body"> & {
  redirectOnUnauthenticated?: boolean;
  returnTo?: string;
  body?: string | Blob | FormData | URLSearchParams | Record<string, unknown> | null | undefined;
};

type BrowserWindow = {
  location: {
    pathname: string;
    search: string;
    hash: string;
    origin: string;
    assign: (url: string) => void;
  };
};

const getBrowserWindow = (): BrowserWindow | undefined => (globalThis as { window?: BrowserWindow }).window;

const resolveDefaultReturnTo = (): string => {
  const browserWindow = getBrowserWindow();

  if (!browserWindow) {
    return `/`;
  }

  return `${browserWindow.location.pathname}${browserWindow.location.search}${browserWindow.location.hash}`;
};

export const redirectToAuthentication = (returnTo = resolveDefaultReturnTo()): never => {
  const browserWindow = getBrowserWindow();

  if (browserWindow) {
    const authenticationRoute = new URL(`/authentication?returnTo=${encodeURIComponent(returnTo)}`, browserWindow.location.origin).toString();
    browserWindow.location.assign(authenticationRoute);
  }

  throw new UnauthenticatedError();
};

export const authenticatedFetch = async (input: string | URL, init: AuthenticatedRequestInit = {}): Promise<Response> => {
  const { redirectOnUnauthenticated = true, returnTo, credentials, ...requestInit } = init;

  // Auto-stringify body if it's not already a string
  const payload = requestInit.body;
  const body = payload && typeof payload !== `string` ? JSON.stringify(payload) : payload;

  const response = await fetch(input, {
    ...requestInit,
    body,
    credentials: credentials ?? `include`,
  } as RequestInit);

  if (response.status === 401 && redirectOnUnauthenticated) {
    redirectToAuthentication(returnTo);
  }

  return response;
};

const withJsonHeaders = (headers: AuthenticatedRequestInit["headers"]): Record<string, string> => {
  const nextHeaders: Record<string, string> = {};

  if (headers && typeof headers === `object` && !Array.isArray(headers)) {
    for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
      if (typeof value === `string`) {
        nextHeaders[key] = value;
      }
    }
  }

  if (!(`Accept` in nextHeaders) && !(`accept` in nextHeaders)) {
    nextHeaders.Accept = `application/json`;
  }

  if (!(`Content-Type` in nextHeaders) && !(`content-type` in nextHeaders)) {
    nextHeaders[`Content-Type`] = `application/json`;
  }

  return nextHeaders;
};

export const authenticatedJsonGet = async (input: string | URL, init: Omit<AuthenticatedRequestInit, "method" | "body"> = {}): Promise<Response> =>
  authenticatedFetch(input, {
    ...init,
    method: `GET`,
    headers: withJsonHeaders(init.headers),
  });

export const authenticatedJsonPost = async (input: string | URL, body: AuthenticatedRequestInit["body"], init: Omit<AuthenticatedRequestInit, "method" | "body"> = {}): Promise<Response> =>
  authenticatedFetch(input, {
    ...init,
    method: `POST`,
    headers: withJsonHeaders(init.headers),
    body,
  });

export const authenticatedJsonPut = async (input: string | URL, body: AuthenticatedRequestInit["body"], init: Omit<AuthenticatedRequestInit, "method" | "body"> = {}): Promise<Response> =>
  authenticatedFetch(input, {
    ...init,
    method: `PUT`,
    headers: withJsonHeaders(init.headers),
    body,
  });

export const authenticatedJsonDelete = async (input: string | URL, options: { body?: AuthenticatedRequestInit["body"] } & Omit<AuthenticatedRequestInit, "method" | "body"> = {}): Promise<Response> => {
  const { body, ...init } = options;

  return authenticatedFetch(input, {
    ...init,
    method: `DELETE`,
    headers: withJsonHeaders(init.headers),
    body,
  });
};
