import { config } from "@components/config/config.js";
import { registerLogging } from "@components/logging/logging.service.js";
import type { Express } from "express";

export const defineLogging = (app: Express): void => {
  registerLogging(app, {
    headerName: config.logging.traceHeaderName,
    serviceName: config.logging.serviceName,
    level: config.logging.level,
    enabled: config.logging.enabled,
  });
};
