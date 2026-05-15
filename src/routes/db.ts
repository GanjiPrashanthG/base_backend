import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { API_DB_HEALTH_PATH } from "../constants.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export function createDbRouter(prisma: PrismaClient) {
  const router = Router();

  router.get(
    API_DB_HEALTH_PATH,
    asyncHandler(async (_req, res) => {
      const started = Date.now();
      await prisma.$runCommandRaw({ ping: 1 });
      res.json({ ok: true, latencyMs: Date.now() - started });
    }),
  );

  return router;
}
