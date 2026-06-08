import { getUser } from "@components/authentication/session.js";
import type { NextFunction, Request, Response } from "express";

export function requireAuthentication(req: Request, res: Response, next: NextFunction) {
  const user = getUser(req);

  if (!user) {
    return res.sendStatus(401);
  }

  next();
}
