import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { Env } from "../config.js";
import { createDbRouter } from "./db.js";
import exampleRouter from "./example.js";
import { createMigrationsRouter } from "./migrations.js";
import openapiRouter from "./openapi.js";

/**
 * All versioned HTTP API routes (mounted at `/api` and `/api/v1`).
 */
export function createApiBundleRouter(options: { prisma?: PrismaClient; env: Env }) {
  const { prisma, env } = options;
  const router = Router();
  router.use(exampleRouter);
  router.use(openapiRouter);
  if (prisma !== undefined) {
    router.use(createDbRouter(prisma));
    router.use(createMigrationsRouter(prisma, env));
  }
  return router;
}
