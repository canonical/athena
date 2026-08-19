import { config } from "@components/config/config.js";
import cookieSession from "cookie-session";
import type { Express } from "express";
import passport from "passport";

import { defineCors } from "./define-cors.js";
import { defineExtensions } from "./define-extensions.js";
import { defineLogging } from "./define-logging.js";

/**
 * Registers Athena's core HTTP middleware stack, mirroring the Zeus pattern.
 */
export const defineMiddlewares = (app: Express) => {
  app.use(
    cookieSession({
      name: `session`,
      keys: [config.authentication.session.secret],
      maxAge: config.authentication.session.maxAgeMs,
      secure: config.application.nodeEnv === `production` ? undefined : false,
      secureProxy: config.application.nodeEnv === `production`,
      httpOnly: true,
      sameSite: `lax`,
    }),
  );

  defineLogging(app);
  app.use(passport.initialize());
  defineExtensions(app);
  defineCors(app);
};
