import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import {
  HEALTH_LIVENESS_BODY,
  HEALTH_READY_PATH,
  HEALTH_ROUTE_PATH,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
} from "../constants.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export type CreateHealthRouterOptions = {
  prisma?: PrismaClient;
  mongodbEnabled: boolean;
};

export function createHealthRouter(options: CreateHealthRouterOptions) {
  const { prisma, mongodbEnabled } = options;
  const router = Router();

  router.get(HEALTH_ROUTE_PATH, (_req, res) => {
    res.json(HEALTH_LIVENESS_BODY);
  });

  router.get(
    HEALTH_READY_PATH,
    asyncHandler(async (_req, res) => {
      if (!mongodbEnabled || prisma === undefined) {
        res.json({ ready: true, database: "disabled" });
        return;
      }
      const started = Date.now();
      try {
        await prisma.$runCommandRaw({ ping: 1 });
        res.json({ ready: true, database: "ok", latencyMs: Date.now() - started });
      } catch {
        res.status(HTTP_STATUS_SERVICE_UNAVAILABLE).json({
          ready: false,
          database: "unavailable",
        });
      }
    }),
  );

  return router;
}
