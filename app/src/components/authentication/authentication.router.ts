import {
  buildProfileResponse,
  clearSession,
  consumeReturnTo,
  deleteAuthenticationSession,
  ensureOidcStrategy,
  getAuthenticatedUser,
  normalizeReturnTo,
  passport,
  storeAuthenticatedUser,
  storeReturnTo,
} from "@components/authentication/authentication.controller.js";
import { getSession, getSessionId } from "@components/authentication/session.js";
import { config } from "@components/config/config.js";
import { type NextFunction, type Request, type Response, Router } from "express";

export const authenticationRouter = Router();

authenticationRouter.get(`/authentication/login`, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const returnTo = normalizeReturnTo(req.query.returnTo);

    if (await getAuthenticatedUser(getSessionId(req))) {
      res.redirect(returnTo ?? config.frontend.baseUrl);
      return;
    }

    storeReturnTo(getSession(req), returnTo);

    await ensureOidcStrategy();
    passport.authenticate(`oidc`)(req, res, next);
  } catch (error) {
    next(error);
  }
});

authenticationRouter.get(`/authentication/callback`, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureOidcStrategy();

    passport.authenticate(`oidc`, (error: unknown, user: Express.User | false) => {
      if (error) {
        return next(error);
      }

      if (!user) {
        return res.redirect(`/authentication/login`);
      }

      const session = getSession(req);

      void storeAuthenticatedUser(session, user)
        .then(() => {
          res.redirect(consumeReturnTo(session));
        })
        .catch(next);
    })(req, res, next);
  } catch (error) {
    next(error);
  }
});

authenticationRouter.get(`/authentication/logout`, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteAuthenticationSession(getSessionId(req));
    req.session = clearSession();
    res.redirect(config.frontend.baseUrl);
  } catch (error) {
    next(error);
  }
});

authenticationRouter.get(`/authentication/profile`, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(buildProfileResponse(await getAuthenticatedUser(getSessionId(req))));
  } catch (error) {
    next(error);
  }
});
