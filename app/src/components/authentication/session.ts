import type { AuthUser, SessionData } from "@components/authentication/session.schema.js";
import type { Request } from "express";

export function getSession(req: Request): SessionData | null {
  return req.session as SessionData | null;
}

export function getUser(req: Request): AuthUser | undefined {
  const session = getSession(req);
  return session?.user;
}
