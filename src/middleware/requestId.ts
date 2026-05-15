import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { HEADER_X_REQUEST_ID } from "../constants.js";

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.headers[HEADER_X_REQUEST_ID];
  const id =
    typeof incoming === "string" && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
};
