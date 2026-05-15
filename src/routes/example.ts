import { Router } from "express";
import { z } from "zod";
import {
  API_ECHO_PATH,
  API_HELLO_PATH,
  DEFAULT_HELLO_NAME,
  ECHO_BODY_TEXT_MAX_LENGTH,
  HELLO_QUERY_NAME_MAX_LENGTH,
  SCHEMA_MIN_STRING_LENGTH,
} from "../constants.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { validateRequest } from "../lib/validate.js";

const router = Router();

const helloQuery = z.object({
  name: z.string().min(SCHEMA_MIN_STRING_LENGTH).max(HELLO_QUERY_NAME_MAX_LENGTH).optional(),
});

router.get(API_HELLO_PATH, validateRequest({ query: helloQuery }), (_req, res) => {
  const query = res.locals.validated?.query as z.infer<typeof helloQuery> | undefined;
  const name = query?.name ?? DEFAULT_HELLO_NAME;
  res.json({ message: `Hello, ${name}` });
});

const echoBody = z.object({
  text: z.string().min(SCHEMA_MIN_STRING_LENGTH).max(ECHO_BODY_TEXT_MAX_LENGTH),
});

router.post(
  API_ECHO_PATH,
  validateRequest({ body: echoBody }),
  asyncHandler(async (_req, res) => {
    const body = res.locals.validated?.body as z.infer<typeof echoBody> | undefined;
    res.json({ echo: body?.text });
  }),
);

export default router;
