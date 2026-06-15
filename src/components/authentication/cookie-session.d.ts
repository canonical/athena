import type { AuthenticatedUser, Session } from "@components/authentication/session.schema.js";

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}

    interface Request {
      session?: Session | null;
    }

    interface Locals {
      user?: User;
    }
  }
}
