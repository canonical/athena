import type { Express } from "express";
import express from "express";

export const defineExtensions = (app: Express) => {
  app.use(express.json({ limit: `12mb` }));
  app.use(express.urlencoded({ extended: true, limit: `12mb` }));
};
