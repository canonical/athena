import type { User as AthenaUser, Session } from "@components/authentication/session.schema.js";

declare global {
  namespace Express {
    interface Request {
      session?: Session | null;
      authenticatedUser?: AthenaUser;
    }
  }
}
