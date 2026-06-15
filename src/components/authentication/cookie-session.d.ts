import type { Session, User as AthenaUser } from "@components/authentication/session.schema.js";

declare global {
  namespace Express {
    interface Request {
      session?: Session | null;
      authenticatedUser?: AthenaUser;
    }
  }
}
