import { Router } from "express";
import {
  API_DOCS_PATH,
  API_ROUTE_PREFIX,
  API_ROUTE_PREFIX_V1,
  API_OPENAPI_PATH,
  HEALTH_READY_PATH,
  HEALTH_ROUTE_PATH,
  API_MIGRATIONS_PATH,
  METRICS_ROUTE_PATH,
} from "../constants.js";
import { packageInfo } from "../lib/packageInfo.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    service: packageInfo.name,
    version: packageInfo.version,
    links: {
      health: HEALTH_ROUTE_PATH,
      healthReady: HEALTH_READY_PATH,
      metrics: METRICS_ROUTE_PATH,
      docs: API_DOCS_PATH,
      openapi: `${API_ROUTE_PREFIX_V1}${API_OPENAPI_PATH}`,
      hello: `${API_ROUTE_PREFIX_V1}/hello`,
      migrations: `${API_ROUTE_PREFIX_V1}${API_MIGRATIONS_PATH}`,
      dbHealth: `${API_ROUTE_PREFIX_V1}/db/health`,
      apiV1: API_ROUTE_PREFIX_V1,
      apiLegacy: API_ROUTE_PREFIX,
    },
  });
});

export default router;
