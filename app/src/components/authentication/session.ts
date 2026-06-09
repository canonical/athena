import type { Session } from "@components/authentication/session.schema.js";
import type { Request } from "express";

export function getSession(req: Request): Session | null {
  return req.session as Session | null;
}

export function getSessionId(req: Request): string | undefined {
  const session = getSession(req);
  return session?.id;
}
