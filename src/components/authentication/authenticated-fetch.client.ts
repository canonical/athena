export class UnauthenticatedError extends Error {
  constructor(message = `Authentication required`) {
    super(message);
    this.name = `UnauthenticatedError`;
  }
}

type AuthenticatedRequestInit = RequestInit & {
  redirectOnUnauthenticated?: boolean;
  returnTo?: string;
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
  const response = await fetch(input, {
    ...requestInit,
    credentials: credentials ?? `include`,
  });

  if (response.status === 401 && redirectOnUnauthenticated) {
    redirectToAuthentication(returnTo);
  }

  return response;
};
