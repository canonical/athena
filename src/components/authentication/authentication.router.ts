import {
  buildProfileResponse,
  clearSession,
  consumeReturnTo,
  deleteAuthenticationSession,
  ensureOidcStrategy,
  getAuthenticatedUser,
  normalizeReturnTo,
  passport,
  resolveFrontendReturnTo,
  storeAuthenticatedUser,
  storeReturnTo,
} from "@components/authentication/authentication.controller.js";
import { getSession, getSessionId } from "@components/authentication/session.js";
import { config } from "@components/config/config.js";
import { defineRoutes } from "@components/express/express.router.js";
import { type Request, Router } from "express";

export const authenticationRouter = Router();
const route = defineRoutes(authenticationRouter);

const frontendOrigin = new URL(config.frontend.baseUrl).origin;

const isAllowedLogoutOrigin = (req: Request): boolean => {
  const origin = req.get(`origin`);

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === frontendOrigin;
  } catch {
    return false;
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
    passport.authenticate(`oidc`)(request, response, next);
  },
});

route({
  method: `get`,
  route: `/callback`,
  handler: async ({ request, response, next }) => {
    await ensureOidcStrategy();

    passport.authenticate(`oidc`, (error: unknown, user: Express.User | false) => {
      if (error) {
        return next(error);
      }

      if (!user) {
        return response.redirect(`${request.baseUrl}/login`);
      }

      const session = getSession(request);

      void storeAuthenticatedUser(session, user)
        .then(() => {
          response.redirect(consumeReturnTo(session));
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
