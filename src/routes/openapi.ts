import { Router } from "express";
import {
  API_DB_HEALTH_PATH,
  API_DOCS_PATH,
  API_ECHO_PATH,
  API_HELLO_PATH,
  API_MIGRATIONS_PATH,
  API_OPENAPI_PATH,
  API_ROUTE_PREFIX,
  API_ROUTE_PREFIX_V1,
  HEALTH_READY_PATH,
  HEALTH_ROUTE_PATH,
} from "../constants.js";
import { packageInfo } from "../lib/packageInfo.js";

const router = Router();

function buildApiPaths(prefix: string) {
  return {
    [`${prefix}${API_HELLO_PATH}`]: {
      get: {
        summary: "Hello (query name optional)",
        responses: { "200": { description: "JSON message" } },
      },
    },
    [`${prefix}${API_ECHO_PATH}`]: {
      post: {
        summary: "Echo JSON body.text",
        responses: { "200": { description: "Echo" } },
      },
    },
    [`${prefix}${API_DB_HEALTH_PATH}`]: {
      get: {
        summary: "Database ping (when MongoDB enabled)",
        responses: { "200": { description: "OK + latencyMs" } },
      },
    },
    [`${prefix}${API_OPENAPI_PATH}`]: {
      get: {
        summary: "OpenAPI document",
        responses: { "200": { description: "OpenAPI JSON" } },
      },
    },
    [`${prefix}${API_MIGRATIONS_PATH}`]: {
      get: {
        summary: "Applied migrate-mongo revisions (admin)",
        responses: {
          "200": { description: "Changelog rows from MongoDB" },
          "401": { description: "Admin key required or invalid" },
        },
      },
    },
  };
}

router.get(API_OPENAPI_PATH, (_req, res) => {
  const base = { title: packageInfo.name, version: packageInfo.version };
  res.json({
    openapi: "3.1.0",
    info: {
      title: base.title,
      version: base.version,
    },
    paths: {
      [HEALTH_ROUTE_PATH]: {
        get: {
          summary: "Liveness",
          responses: { "200": { description: "OK" } },
        },
      },
      [HEALTH_READY_PATH]: {
        get: {
          summary: "Readiness (DB ping when Mongo enabled)",
          responses: {
            "200": { description: "Ready" },
            "503": { description: "Database unavailable" },
          },
        },
      },
      ...buildApiPaths(API_ROUTE_PREFIX),
      ...buildApiPaths(API_ROUTE_PREFIX_V1),
      [API_DOCS_PATH]: {
        get: {
          summary: "Scalar API reference (OpenAPI UI)",
          responses: { "200": { description: "HTML" } },
        },
      },
    },
  });
});

export default router;
