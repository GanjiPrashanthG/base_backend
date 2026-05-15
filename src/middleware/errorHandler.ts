import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import {
  API_ERROR_CODE_GENERIC,
  API_ERROR_CODE_INTERNAL,
  API_ERROR_CODE_PAYLOAD_TOO_LARGE,
  API_ERROR_CODE_VALIDATION,
  EXPRESS_ENTITY_TOO_LARGE,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_CLIENT_ERROR_MAX_EXCLUSIVE,
  HTTP_STATUS_CLIENT_ERROR_MIN,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_PAYLOAD_TOO_LARGE,
  HTTP_STATUS_SERVER_ERROR_MIN,
  NODE_ENV_PRODUCTION,
  ZOD_ISSUE_PATH_SEPARATOR,
} from "../constants.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if ((err as { type?: string }).type === EXPRESS_ENTITY_TOO_LARGE) {
    res.status(HTTP_STATUS_PAYLOAD_TOO_LARGE).json({
      error: API_ERROR_CODE_PAYLOAD_TOO_LARGE,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(HTTP_STATUS_BAD_REQUEST).json({
      error: API_ERROR_CODE_VALIDATION,
      details: err.issues.map((issue) => ({
        path: issue.path.map(String).join(ZOD_ISSUE_PATH_SEPARATOR),
        message: issue.message,
      })),
    });
    return;
  }

  const isProd = process.env.NODE_ENV === NODE_ENV_PRODUCTION;
  const maybeStatus = err as { statusCode?: number };
  const status =
    typeof maybeStatus.statusCode === "number" &&
    maybeStatus.statusCode >= HTTP_STATUS_CLIENT_ERROR_MIN &&
    maybeStatus.statusCode < HTTP_STATUS_CLIENT_ERROR_MAX_EXCLUSIVE
      ? maybeStatus.statusCode
      : HTTP_STATUS_INTERNAL_SERVER_ERROR;

  if (!isProd && status >= HTTP_STATUS_SERVER_ERROR_MIN) {
    req.log?.error({ err }, "unhandled error");
  }

  res.status(status).json({
    error: isProd ? API_ERROR_CODE_INTERNAL : err instanceof Error ? err.message : API_ERROR_CODE_GENERIC,
  });
};
