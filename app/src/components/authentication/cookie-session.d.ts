import type { SessionData } from "@components/authentication/session.schema.js";

declare global {
  namespace Express {
    interface Request {
      session?: SessionData | null;
    }
  }
}
