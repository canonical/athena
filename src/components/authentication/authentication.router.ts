import {
  buildProfileResponse,
  clearSession,
  consumeReturnTo,
  deleteAuthenticationSession,
  ensureOidcStrategy,
  getAuthenticatedUser,
  normalizeReturnTo,
  passport,
  resolveExternalOrigin,
  resolveFrontendReturnTo,
  storeAuthenticatedUser,
  storeReturnTo,
} from "@components/authentication/authentication.controller.js";
import { getSession, getSessionId } from "@components/authentication/session.js";
import { config } from "@components/config/config.js";
import { defineRoutes } from "@components/express/express.router.js";
import { type Request, Router } from "express";
import type { AuthenticateOptions } from "openid-client/passport";

export const authenticationRouter = Router();
const route = defineRoutes(authenticationRouter);

const allowedLogoutOrigins = new Set(
  config.cors.allowedOrigins
    .map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return undefined;
      }
    })
    .filter((origin): origin is string => Boolean(origin)),
);

const isAllowedLogoutOrigin = (req: Request): boolean => {
  const origin = req.get(`origin`);

  if (!origin) {
    return false;
  }

  try {
    return allowedLogoutOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
};

const rewriteAuthorizationRedirectUrl = (req: Request, value: string): string => {
  const origin = resolveExternalOrigin(req);

  if (!origin) {
    return value;
  }

  try {
    const current = new URL(value);

    if (current.pathname !== `/dex/auth`) {
      return value;
    }

    return new URL(`${current.pathname}${current.search}`, origin).toString();
  } catch {
    return value;
  }
};

route({
  method: `get`,
  route: `/login`,
  handler: async ({ request, response, next }) => {
    const returnTo = normalizeReturnTo(request.query.returnTo);

    if (await getAuthenticatedUser(getSessionId(request))) {
      response.redirect(resolveFrontendReturnTo(returnTo));
      return;
    }

    storeReturnTo(getSession(request), returnTo);

    await ensureOidcStrategy();
    const options = { callbackURL: config.authentication.oidc.oauthCallbackUrl } as unknown as AuthenticateOptions;

    const originalSetHeader = response.setHeader.bind(response);
    response.setHeader = ((name: string, value: number | string | readonly string[]): typeof response => {
      if (name.toLowerCase() === `location` && typeof value === `string`) {
        return originalSetHeader(name, rewriteAuthorizationRedirectUrl(request, value));
      }

      return originalSetHeader(name, value);
    }) as typeof response.setHeader;

    passport.authenticate(`oidc`, options)(request, response, next);
  },
});

route({
  method: `get`,
  route: `/callback`,
  handler: async ({ request, response, next }) => {
    await ensureOidcStrategy();
    const callbackURL = config.authentication.oidc.oauthCallbackUrl;
    const options = { callbackURL } as unknown as AuthenticateOptions;

    passport.authenticate(`oidc`, options, (error: unknown, user: Express.User | false) => {
      if (error) {
        return next(error);
      }

      if (!user) {
        return response.redirect(`${request.baseUrl}/login`);
      }

      const session = getSession(request);

      void storeAuthenticatedUser(session, user)
        .then(() => {
          response.redirect(consumeReturnTo(session, request));
        })
        .catch(next);
    })(request, response, next);
  },
});

route({
  method: `post`,
  route: `/logout`,
  handler: async ({ request, fail, respond }) => {
    if (!isAllowedLogoutOrigin(request)) {
      fail({ status: 403, message: `Forbidden.` });
      return;
    }

    await deleteAuthenticationSession(getSessionId(request));
    request.session = clearSession();
    respond({ status: 204 });
  },
});

route({
  method: `get`,
  route: `/profile`,
  handler: async ({ request, respond }) => {
    const profile = buildProfileResponse(await getAuthenticatedUser(getSessionId(request)));
    respond({ status: 200, data: profile });
  },
});
