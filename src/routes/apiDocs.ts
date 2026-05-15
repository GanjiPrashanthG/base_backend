import { Router } from "express";
import { apiReference } from "@scalar/express-api-reference";
import { API_OPENAPI_PATH, API_ROUTE_PREFIX_V1 } from "../constants.js";

const router = Router();

router.use(
  "/",
  apiReference({
    spec: {
      url: `${API_ROUTE_PREFIX_V1}${API_OPENAPI_PATH}`,
    },
  }),
);

export default router;
