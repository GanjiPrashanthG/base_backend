import { Router } from "express";
import type { Env } from "../config.js";
import type { AppMongo } from "../lib/mongo.js";
import { createDbRouter } from "./db.js";
import exampleRouter from "./example.js";
import { createMigrationsRouter } from "./migrations.js";
import openapiRouter from "./openapi.js";

export function createApiBundleRouter(options: { mongo?: AppMongo; env: Env }) {
  const { mongo, env } = options;
  const router = Router();

  router.use(exampleRouter);
  router.use(openapiRouter);
  if (mongo !== undefined) {
    router.use(createDbRouter(mongo));
    router.use(createMigrationsRouter(mongo, env));
  }

  return router;
}
