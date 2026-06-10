import { getAuthenticatedUser } from "@components/authentication/authentication.controller.js";
import { getSessionId } from "@components/authentication/session.js";
import type { NextFunction, Request, Response } from "express";

export async function requireAuthentication(req: Request, res: Response, next: NextFunction) {
  const user = await getAuthenticatedUser(getSessionId(req));

  if (!user) {
    return res.sendStatus(401);
  }

  next();
}
