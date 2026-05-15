import { Router, type RequestHandler } from "express";

/** Defers loading Scalar until the first docs request (saves startup heap when docs are enabled). */
export function createLazyApiDocsRouter(): Router {
  const router = Router();
  let handler: RequestHandler | undefined;

  router.use((req, res, next) => {
    void (async () => {
      try {
        if (!handler) {
          const { default: docsRouter } = await import("./apiDocs.js");
          handler = docsRouter;
        }
        handler(req, res, next);
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
