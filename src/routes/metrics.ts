import { collectDefaultMetrics, register } from "prom-client";
import { Router } from "express";
import { METRICS_ROUTE_PATH } from "../constants.js";

let defaultMetricsStarted = false;

const router = Router();

router.get(METRICS_ROUTE_PATH, async (_req, res) => {
  if (!defaultMetricsStarted) {
    collectDefaultMetrics();
    defaultMetricsStarted = true;
  }
  res.setHeader("Content-Type", register.contentType);
  res.end(await register.metrics());
});

export default router;
