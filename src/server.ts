import { createServer } from "node:http";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import type { PrismaClient } from "@prisma/client";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import {
  EXIT_FAILURE,
  EXIT_SUCCESS,
  LISTEN_ERROR_EADDRINUSE,
  LOG_HINT_MONGODB_CONNECTION_FAILED,
  LOG_MESSAGE_MONGODB_DISABLED,
  NODE_ENV_PRODUCTION,
  OS_SIGNAL_SIGINT,
  OS_SIGNAL_SIGTERM,
} from "./constants.js";
import { createLogger } from "./lib/logger.js";
import { createPrismaClient } from "./lib/prisma.js";

let prisma: PrismaClient | undefined;

async function main() {
  const config = loadConfig();
  if (config.SENTRY_DSN?.trim()) {
    const release = config.SENTRY_RELEASE?.trim();
    const isProd = config.NODE_ENV === NODE_ENV_PRODUCTION;
    const tracesSampleRate = isProd ? 0.05 : 1.0;
    const profilingOptions = config.SENTRY_ENABLE_PROFILING
      ? {
          integrations: [nodeProfilingIntegration()],
          profileSessionSampleRate: tracesSampleRate,
          profileLifecycle: "trace" as const,
        }
      : {};
    Sentry.init({
      dsn: config.SENTRY_DSN.trim(),
      environment: config.NODE_ENV,
      ...(release ? { release } : {}),
      tracesSampleRate,
      enableLogs: config.SENTRY_ENABLE_LOGS,
      sendDefaultPii: config.SENTRY_SEND_DEFAULT_PII,
      ...profilingOptions,
    });
  }

  const logger = createLogger(config);

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "unhandledRejection");
    if (Sentry.isInitialized()) {
      Sentry.captureException(
        reason instanceof Error ? reason : new Error(String(reason)),
      );
    }
  });
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "uncaughtException");
    if (Sentry.isInitialized()) {
      Sentry.captureException(err);
    }
    process.exit(EXIT_FAILURE);
  });

  if (config.MONGODB_ENABLED) {
    try {
      prisma = createPrismaClient(config.databaseUrl, config.NODE_ENV);
      await prisma.$connect();
      await prisma.$runCommandRaw({ ping: 1 });
      logger.info("prisma connected");
    } catch (err) {
      logger.error({ err }, "failed to connect prisma / mongodb");
      logger.info(LOG_HINT_MONGODB_CONNECTION_FAILED);
      process.exit(EXIT_FAILURE);
    }
  } else {
    logger.warn(LOG_MESSAGE_MONGODB_DISABLED);
  }

  const app = createApp({ logger, env: config, prisma });
  const server = createServer(app);
  server.requestTimeout = config.HTTP_REQUEST_TIMEOUT_MS;
  server.headersTimeout = config.HTTP_HEADERS_TIMEOUT_MS;

  server.on("error", (err: NodeJS.ErrnoException) => {
    void (async () => {
      if (err.code === LISTEN_ERROR_EADDRINUSE) {
        logger.error(
          { host: config.HOST, port: config.PORT, err },
          "listen failed: address already in use — stop the other process or set PORT to a free port",
        );
      } else {
        logger.error({ err }, "http server listen error");
      }
      try {
        if (prisma) {
          await prisma.$disconnect();
          prisma = undefined;
        }
      } catch (closeErr) {
        logger.error({ err: closeErr }, "error disconnecting prisma after listen failure");
      }
      process.exit(EXIT_FAILURE);
    })();
  });

  server.listen(config.PORT, config.HOST, () => {
    logger.info({ port: config.PORT, host: config.HOST }, "server listening");
  });

  let shutdownStarted = false;
  let shutdownForceTimer: ReturnType<typeof setTimeout> | undefined;
  function shutdown(signal: string) {
    if (shutdownStarted) {
      return;
    }
    shutdownStarted = true;
    logger.info({ signal }, "shutdown");
    shutdownForceTimer = setTimeout(() => {
      logger.error(
        { graceMs: config.SHUTDOWN_GRACE_MS },
        "shutdown grace elapsed; forcing exit",
      );
      process.exit(EXIT_SUCCESS);
    }, config.SHUTDOWN_GRACE_MS);
    server.close((closeErr) => {
      void (async () => {
        if (shutdownForceTimer !== undefined) {
          clearTimeout(shutdownForceTimer);
          shutdownForceTimer = undefined;
        }
        try {
          if (prisma) {
            await prisma.$disconnect();
            prisma = undefined;
          }
        } catch (err) {
          logger.error({ err }, "error disconnecting prisma");
        }
        if (closeErr) {
          logger.error(closeErr);
          process.exit(EXIT_FAILURE);
        }
        if (Sentry.isInitialized()) {
          await Sentry.close(2000);
        }
        process.exit(EXIT_SUCCESS);
      })();
    });
  }

  process.on(OS_SIGNAL_SIGINT, () => {
    shutdown(OS_SIGNAL_SIGINT);
  });
  process.on(OS_SIGNAL_SIGTERM, () => {
    shutdown(OS_SIGNAL_SIGTERM);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(EXIT_FAILURE);
});
