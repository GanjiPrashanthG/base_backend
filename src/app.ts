import compression from "compression";
import cors, { type CorsOptions } from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppMongo } from "./lib/mongo.js";
import { pinoHttp } from "pino-http";
import type { Logger } from "pino";
import {
  API_DOCS_PATH,
  API_ROUTE_PREFIX,
  API_ROUTE_PREFIX_V1,
  EXPRESS_URLENCODED_EXTENDED,
  HEALTH_READY_PATH,
  HEALTH_ROUTE_PATH,
  HTTP_ACCESS_LOG_IGNORE_GET_PATHS,
  METRICS_ROUTE_PATH,
  NODE_ENV_PRODUCTION,
} from "./constants.js";
import type { Env } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { requireAdminKeyStrict } from "./middleware/requireAdminKey.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { createApiBundleRouter } from "./routes/apiBundle.js";
import { createLazyApiDocsRouter } from "./routes/apiDocsLazy.js";
import type { SentryModule } from "./lib/sentry.js";
import { createHealthRouter } from "./routes/health.js";
import { createLazyMetricsRouter } from "./routes/metricsLazy.js";
import rootRouter from "./routes/root.js";

function shouldIgnoreHttpAccessLog(req: Pick<IncomingMessage, "method" | "url">): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return false;
  }
  const pathOnly = req.url?.split("?")[0] ?? "";
  if (pathOnly === API_DOCS_PATH || pathOnly.startsWith(`${API_DOCS_PATH}/`)) {
    return true;
  }
  return HTTP_ACCESS_LOG_IGNORE_GET_PATHS.has(pathOnly);
}

function slimReqSerializer(req: IncomingMessage) {
  const extended = req as IncomingMessage & { id?: unknown };
  return {
    id: extended.id,
    method: req.method,
    url: req.url,
    remoteAddress: req.socket?.remoteAddress,
    remotePort: req.socket?.remotePort,
    headers: { host: req.headers.host },
  };
}

function slimResSerializer(res: ServerResponse) {
  return { statusCode: res.statusCode };
}

function buildCorsOptions(env: Env): CorsOptions {
  const raw = env.CORS_ORIGIN?.trim();
  if (raw) {
    const origins = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (origins.length === 1) {
      return { origin: origins[0] };
    }
    return { origin: origins };
  }
  if (env.NODE_ENV === NODE_ENV_PRODUCTION) {
    return { origin: false };
  }
  return { origin: true };
}

function mountMetricsRouter(env: Env): ReturnType<typeof express.Router> | undefined {
  if (!env.METRICS_ENABLED) {
    return undefined;
  }
  const r = express.Router();
  if (env.METRICS_REQUIRE_AUTH) {
    r.use(requireAdminKeyStrict(env));
  }
  r.use(createLazyMetricsRouter());
  return r;
}

export type CreateAppOptions = {
  logger: Logger;
  env: Env;
  mongo?: AppMongo;
  sentry?: SentryModule;
};

export function createApp(options: CreateAppOptions) {
  const { logger, env, mongo, sentry } = options;
  const app = express();
  app.disable("x-powered-by");

  if (env.TRUST_PROXY_HOPS > 0) {
    app.set("trust proxy", env.TRUST_PROXY_HOPS);
  }

  app.use(requestIdMiddleware);
  app.use(compression());
  app.use(cors(buildCorsOptions(env)));
  if (env.API_DOCS_ENABLED) {
    app.use(API_DOCS_PATH, createLazyApiDocsRouter());
  }
  const metrics = mountMetricsRouter(env);
  if (metrics) {
    app.use(metrics);
  }
  app.use(helmet());
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        const p = req.path;
        return (
          p === "/" ||
          p === HEALTH_ROUTE_PATH ||
          p === HEALTH_READY_PATH ||
          p === METRICS_ROUTE_PATH ||
          p === API_DOCS_PATH ||
          p.startsWith(`${API_DOCS_PATH}/`)
        );
      },
    }),
  );
  app.use(express.json({ limit: `${env.JSON_BODY_LIMIT_MB}mb` }));
  app.use(express.urlencoded({ extended: EXPRESS_URLENCODED_EXTENDED, limit: `${env.JSON_BODY_LIMIT_MB}mb` }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id ?? "",
      autoLogging: { ignore: (req) => shouldIgnoreHttpAccessLog(req) },
      serializers: {
        req: slimReqSerializer,
        res: slimResSerializer,
      },
    }),
  );

  app.use(rootRouter);
  app.use(createHealthRouter({ mongo, mongodbEnabled: env.MONGODB_ENABLED }));
  const apiBundle = createApiBundleRouter({ mongo, env });
  app.use(API_ROUTE_PREFIX, apiBundle);
  app.use(API_ROUTE_PREFIX_V1, apiBundle);

  if (sentry?.isInitialized()) {
    sentry.setupExpressErrorHandler(app);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
