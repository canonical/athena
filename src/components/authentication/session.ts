import type { AuthenticatedUser, Session } from "@components/authentication/session.schema.js";
import type { Request, Response } from "express";

export function getSession(req: Request): Session | null {
  return req.session ?? null;
}

export function getSessionId(req: Request): string | undefined {
  const session = getSession(req);
  return session?.id;
}

export function getAuthenticatedUserId(response: Response): string {
  const user = response.locals.user as AuthenticatedUser | undefined;

  if (!user) {
    throw new Error(`Authenticated user not found in request context.`);
  }

  return user.id;
}

export function getAuthenticatedUser(response: Response): AuthenticatedUser {
  const user = response.locals.user as AuthenticatedUser | undefined;

  if (!user) {
    throw new Error(`Authenticated user not found in request context.`);
  }

  return user;
}
