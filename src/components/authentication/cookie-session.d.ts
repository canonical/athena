import type { Session } from "@components/authentication/session.schema.js";

declare global {
  namespace Express {
    interface Request {
      session?: Session | null;
    }
  }
}
