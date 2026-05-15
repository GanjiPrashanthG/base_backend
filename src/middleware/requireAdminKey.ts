import type { IncomingMessage } from "node:http";
import type { RequestHandler } from "express";
import type { Env } from "../config.js";
import {
  API_ERROR_CODE_UNAUTHORIZED,
  HEADER_X_ADMIN_KEY,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
  HTTP_STATUS_UNAUTHORIZED,
  NODE_ENV_PRODUCTION,
} from "../constants.js";

function adminCredentialsMatch(req: Pick<IncomingMessage, "headers">, configured: string): boolean {
  const headerKey = (req.headers[HEADER_X_ADMIN_KEY] ?? "").toString().trim();
  const auth = req.headers.authorization;
  const bearer =
    typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";
  return headerKey === configured || bearer === configured;
}

/**
 * Protects admin-only routes. If `ADMIN_API_KEY` is unset: allow in non-production;
 * in production respond 401 until a key is configured.
 */
export function requireAdminKey(env: Pick<Env, "NODE_ENV" | "ADMIN_API_KEY">): RequestHandler {
  return (req, res, next) => {
    const configured = env.ADMIN_API_KEY?.trim();
    if (!configured) {
      if (env.NODE_ENV === NODE_ENV_PRODUCTION) {
        res.status(HTTP_STATUS_UNAUTHORIZED).json({
          error: API_ERROR_CODE_UNAUTHORIZED,
          message: "Set ADMIN_API_KEY to access this endpoint in production.",
        });
        return;
      }
      next();
      return;
    }

    if (adminCredentialsMatch(req, configured)) {
      next();
      return;
    }

    res.status(HTTP_STATUS_UNAUTHORIZED).json({
      error: API_ERROR_CODE_UNAUTHORIZED,
      message: "Invalid or missing admin credentials (use X-Admin-Key or Authorization: Bearer).",
    });
  };
}

/**
 * Always requires a configured `ADMIN_API_KEY` and matching credentials (all environments).
 * Used when `METRICS_REQUIRE_AUTH=1` so `/metrics` is not public.
 */
export function requireAdminKeyStrict(env: Pick<Env, "ADMIN_API_KEY">): RequestHandler {
  return (req, res, next) => {
    const configured = env.ADMIN_API_KEY?.trim();
    if (!configured) {
      res.status(HTTP_STATUS_SERVICE_UNAVAILABLE).json({
        error: "misconfigured",
        message: "Set ADMIN_API_KEY when METRICS_REQUIRE_AUTH=1.",
      });
      return;
    }
    if (adminCredentialsMatch(req, configured)) {
      next();
      return;
    }
    res.status(HTTP_STATUS_UNAUTHORIZED).json({
      error: API_ERROR_CODE_UNAUTHORIZED,
      message: "Invalid or missing admin credentials (use X-Admin-Key or Authorization: Bearer).",
    });
  };
}
