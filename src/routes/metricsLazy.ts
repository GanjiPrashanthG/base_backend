import { Router, type RequestHandler } from "express";

/** Defers loading prom-client until the first scrape (saves startup heap when metrics are enabled). */
export function createLazyMetricsRouter(): Router {
  const router = Router();
  let handler: RequestHandler | undefined;

  router.use((req, res, next) => {
    void (async () => {
      try {
        if (!handler) {
          const { default: metricsRouter } = await import("./metrics.js");
          handler = metricsRouter;
        }
        handler(req, res, next);
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
