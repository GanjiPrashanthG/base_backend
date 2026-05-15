import { createServer } from "node:http";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { initSentryIfConfigured } from "./lib/sentry.js";
import { connectMongo, type AppMongo } from "./lib/mongo.js";
import {
  EXIT_FAILURE,
  EXIT_SUCCESS,
  LISTEN_ERROR_EADDRINUSE,
  DEFAULT_MAX_POOL_SIZE,
  LOG_HINT_MONGODB_CONNECTION_FAILED,
  LOG_MESSAGE_MONGODB_DISABLED,
  OS_SIGNAL_SIGINT,
  OS_SIGNAL_SIGTERM,
} from "./constants.js";
import { createLogger } from "./lib/logger.js";

let mongo: AppMongo | undefined;

async function main() {
  const config = loadConfig();
  const sentry = await initSentryIfConfigured(config);
  const logger = createLogger(config);

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "unhandledRejection");
    if (sentry?.isInitialized()) {
      sentry.captureException(
        reason instanceof Error ? reason : new Error(String(reason)),
      );
    }
  });
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "uncaughtException");
    if (sentry?.isInitialized()) {
      sentry.captureException(err);
    }
    process.exit(EXIT_FAILURE);
  });

  if (config.MONGODB_ENABLED) {
    try {
      mongo = await connectMongo(
        config.databaseUrl,
        config.MONGODB_MAX_POOL_SIZE ?? DEFAULT_MAX_POOL_SIZE,
      );
      await mongo.ping();
      logger.info("mongodb connected");
    } catch (err) {
      logger.error({ err }, "failed to connect mongodb");
      logger.info(LOG_HINT_MONGODB_CONNECTION_FAILED);
      process.exit(EXIT_FAILURE);
    }
  } else {
    logger.warn(LOG_MESSAGE_MONGODB_DISABLED);
  }

  const app = createApp({ logger, env: config, mongo, sentry });
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
        if (mongo) {
          await mongo.close();
          mongo = undefined;
        }
      } catch (closeErr) {
        logger.error({ err: closeErr }, "error closing mongodb after listen failure");
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
          if (mongo) {
            await mongo.close();
            mongo = undefined;
          }
        } catch (err) {
          logger.error({ err }, "error closing mongodb");
        }
        if (closeErr) {
          logger.error(closeErr);
          process.exit(EXIT_FAILURE);
        }
        if (sentry?.isInitialized()) {
          await sentry.close(2000);
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
