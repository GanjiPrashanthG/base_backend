import type { RequestHandler } from "express";
import {
  API_ERROR_CODE_NOT_FOUND,
  HTTP_STATUS_NOT_FOUND,
} from "../constants.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(HTTP_STATUS_NOT_FOUND).json({
    error: API_ERROR_CODE_NOT_FOUND,
    path: req.originalUrl ?? req.url ?? "",
  });
};
