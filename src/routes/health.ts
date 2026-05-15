import { Router } from "express";
import type { AppMongo } from "../lib/mongo.js";
import {
  HEALTH_LIVENESS_BODY,
  HEALTH_READY_PATH,
  HEALTH_ROUTE_PATH,
} from "../constants.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export type HealthRouterOptions = {
  mongo?: AppMongo;
  mongodbEnabled: boolean;
};

export function createHealthRouter(options: HealthRouterOptions) {
  const router = Router();
  const { mongo, mongodbEnabled } = options;

  router.get(HEALTH_ROUTE_PATH, (_req, res) => {
    res.json(HEALTH_LIVENESS_BODY);
  });

  router.get(
    HEALTH_READY_PATH,
    asyncHandler(async (_req, res) => {
      if (!mongodbEnabled || mongo === undefined) {
        res.json({ ready: true, database: "disabled" });
        return;
      }
      const started = Date.now();
      try {
        await mongo.ping();
        res.json({ ready: true, database: "ok", latencyMs: Date.now() - started });
      } catch {
        res.status(503).json({
          ready: false,
          database: "error",
          latencyMs: Date.now() - started,
        });
      }
    }),
  );

  return router;
}
