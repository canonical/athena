import { buildProfileResponse, clearSession, consumeReturnTo, ensureOidcStrategy, normalizeReturnTo, passport, storeAuthenticatedUser, storeReturnTo } from "@components/authentication/authentication.controller.js";
import { getSession, getUser } from "@components/authentication/session.js";
import { type NextFunction, type Request, type Response, Router } from "express";

export const authenticationRouter = Router();

authenticationRouter.get(`/authentication/login`, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const returnTo = normalizeReturnTo(req.query.returnTo);

    if (getUser(req)) {
      res.redirect(returnTo ?? `/`);
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

      try {
        storeAuthenticatedUser(session, user);
      } catch (storeError) {
        return next(storeError);
      }

      return res.redirect(consumeReturnTo(session));
    })(req, res, next);
  } catch (error) {
    next(error);
  }
});

authenticationRouter.get(`/authentication/logout`, (req: Request, res: Response) => {
  req.session = clearSession();
  res.redirect(`/authentication/login`);
});

authenticationRouter.get(`/authentication/profile`, (req: Request, res: Response) => {
  res.json(buildProfileResponse(getUser(req)));
});
