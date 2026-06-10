import { config } from "@components/config/config.js";
import cors from "cors";
import type { Express } from "express";

/**
 * Register CORS with a strict origin allowlist for Athena frontend callers.
 */
export const defineCors = (app: Express) => {
  app.use(
    cors({
      origin: config.cors.allowedOrigins,
      credentials: true,
    }),
  );
};
