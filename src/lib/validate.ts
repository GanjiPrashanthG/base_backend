import type { NextFunction, Request, Response } from "express";
import type { infer as zInfer } from "zod";
import type { ZodType } from "zod";

type InferOptional<T extends ZodType | undefined> = T extends ZodType ? zInfer<T> : undefined;

export function validateRequest<
  B extends ZodType | undefined = undefined,
  Q extends ZodType | undefined = undefined,
  P extends ZodType | undefined = undefined,
>(schemas: { body?: B; query?: Q; params?: P }) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = schemas.body ? schemas.body.parse(req.body) : undefined;
      const query = schemas.query ? schemas.query.parse(req.query) : undefined;
      const params = schemas.params ? schemas.params.parse(req.params) : undefined;
      res.locals.validated = {
        body: body as InferOptional<B>,
        query: query as InferOptional<Q>,
        params: params as InferOptional<P>,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}
