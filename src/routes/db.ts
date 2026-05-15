import { Router } from "express";
import type { AppMongo } from "../lib/mongo.js";
import { API_DB_HEALTH_PATH } from "../constants.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export function createDbRouter(mongo: AppMongo) {
  const router = Router();

  router.get(
    API_DB_HEALTH_PATH,
    asyncHandler(async (_req, res) => {
      const started = Date.now();
      await mongo.ping();
      res.json({ ok: true, latencyMs: Date.now() - started });
    }),
  );

  return router;
}
