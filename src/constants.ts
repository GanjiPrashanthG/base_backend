/** OS signals used for graceful shutdown */
export const OS_SIGNAL_SIGINT = "SIGINT";
export const OS_SIGNAL_SIGTERM = "SIGTERM";

/** Process exit codes */
export const EXIT_SUCCESS = 0;
export const EXIT_FAILURE = 1;

/** `server.listen` failure: socket address in use */
export const LISTEN_ERROR_EADDRINUSE = "EADDRINUSE";

/** HTTP status codes */
export const HTTP_STATUS_BAD_REQUEST = 400;
export const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
export const HTTP_STATUS_CLIENT_ERROR_MIN = 400;
export const HTTP_STATUS_CLIENT_ERROR_MAX_EXCLUSIVE = 600;

/** API JSON `error` field values */
export const API_ERROR_CODE_VALIDATION = "validation_error";
export const API_ERROR_CODE_INTERNAL = "internal_error";
export const API_ERROR_CODE_GENERIC = "error";
export const API_ERROR_CODE_NOT_FOUND = "not_found";
export const API_ERROR_CODE_PAYLOAD_TOO_LARGE = "payload_too_large";
export const API_ERROR_CODE_UNAUTHORIZED = "unauthorized";

/** HTTP status codes (additional) */
export const HTTP_STATUS_NOT_FOUND = 404;
export const HTTP_STATUS_PAYLOAD_TOO_LARGE = 413;
export const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
export const HTTP_STATUS_UNAUTHORIZED = 401;

/** `NODE_ENV` value for production behavior */
export const NODE_ENV_PRODUCTION = "production";

/** Allowed `NODE_ENV` values (Zod enum) */
export const NODE_ENV_VALUES = ["development", "production", "test"] as const;

/** Pino log levels */
export const LOG_LEVEL_INFO = "info";
export const LOG_LEVEL_DEBUG = "debug";

/** `LOG_PRETTY` env: truthy string values */
export const LOG_PRETTY_ENV_ONE = "1";
export const LOG_PRETTY_ENV_TRUE = "true";

/** pino-pretty transport */
export const PINO_PRETTY_TARGET = "pino-pretty";
export const PINO_PRETTY_TRANSLATE_TIME = "SYS:standard";

/** HTTP API mount path */
export const API_ROUTE_PREFIX = "/api";
/** Versioned mount — same routers as {@link API_ROUTE_PREFIX} */
export const API_ROUTE_PREFIX_V1 = "/api/v1";

/** Route paths */
export const HEALTH_ROUTE_PATH = "/health";
export const HEALTH_READY_PATH = "/health/ready";
export const API_HELLO_PATH = "/hello";
export const API_ECHO_PATH = "/echo";
export const API_DB_HEALTH_PATH = "/db/health";
export const API_OPENAPI_PATH = "/openapi.json";
export const API_MIGRATIONS_PATH = "/migrations";
export const METRICS_ROUTE_PATH = "/metrics";
export const API_DOCS_PATH = "/api/docs";

/** Entity parse / body size (Express body-parser) */
export const EXPRESS_ENTITY_TOO_LARGE = "entity.too.large";
export const HTTP_ACCESS_LOG_IGNORE_GET_PATHS = new Set([
  "/favicon.ico",
  "/service-worker.js",
  "/robots.txt",
  HEALTH_ROUTE_PATH,
  HEALTH_READY_PATH,
  METRICS_ROUTE_PATH,
]);

/** `MONGODB_ENABLED` env: these values (trimmed, lowercased) mean “do not connect” */
export const MONGODB_ENABLED_DISABLED_TOKENS = ["0", "false", "no", "off"] as const;

export function isMongoEnabledFromEnv(raw: string | undefined): boolean {
  if (raw === undefined || raw === "") {
    return true;
  }
  const token = raw.trim().toLowerCase();
  return !(MONGODB_ENABLED_DISABLED_TOKENS as readonly string[]).includes(token);
}

/** Logged when `MONGODB_ENABLED` disables the driver */
export const LOG_MESSAGE_MONGODB_DISABLED = "mongodb disabled; DB routes are not mounted";

/** Logged after Mongo connection failure */
export const LOG_HINT_MONGODB_CONNECTION_FAILED =
  "Start MongoDB (from repo root: docker compose up -d), set DATABASE_URL (or MONGODB_URI + MONGODB_DB_NAME), or set MONGODB_ENABLED=0 to run without DB routes.";

/** Default configuration when env vars are unset */
export const DEFAULT_NODE_ENV = "development";
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 3000;
export const DEFAULT_MONGODB_URI = "mongodb://127.0.0.1:27017";
export const DEFAULT_MONGODB_DB_NAME = "mayday";

/** Default JSON body size limit (MB) for `express.json` */
export const DEFAULT_JSON_BODY_LIMIT_MB = 1;

/** Default rate limit (fixed window) */
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 900_000;
export const DEFAULT_RATE_LIMIT_MAX = 300;

/** MongoDB connection URL tuning (query string) */
export const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 5_000;
export const DEFAULT_MAX_POOL_SIZE = 10;

/** HTTP server (`node:http`) — slowloris / hung request protection */
export const DEFAULT_HTTP_REQUEST_TIMEOUT_MS = 60_000;
export const DEFAULT_HTTP_HEADERS_TIMEOUT_MS = 65_000;

/** After SIGINT/SIGTERM: max wait for `server.close` + MongoDB close before `process.exit` */
export const DEFAULT_SHUTDOWN_GRACE_MS = 15_000;

/** Express `trust proxy`: hop count when behind reverse proxy (0 = off) */
export const DEFAULT_TRUST_PROXY_HOPS = 0;

/** When true, `GET /metrics` requires the same auth as admin routes (`ADMIN_API_KEY`) in every environment */
export const DEFAULT_METRICS_REQUIRE_AUTH = false;

/** Sentry: structured logs to Sentry (`Sentry.logger` API); off by default to avoid surprise volume */
export const DEFAULT_SENTRY_ENABLE_LOGS = false;

/** Sentry: allow default PII (e.g. IP); off by default */
export const DEFAULT_SENTRY_SEND_DEFAULT_PII = false;

/**
 * Sentry: load `@sentry/profiling-node` (native addon). Off by default — enable explicitly in env when you want CPU
 * profiles (Alpine/glibc prebuilds vary; CI/smoke tests stay lean).
 */
export const DEFAULT_SENTRY_ENABLE_PROFILING = false;

/** Mount Scalar at `/api/docs` when env unset (off by default in production via config transform) */
export const DEFAULT_API_DOCS_ENABLED = true;

/** Expose Prometheus metrics at `GET /metrics` */
export const DEFAULT_METRICS_ENABLED = true;

/** Env strings treated as boolean true (trimmed, lowercased) */
export const ENV_TRUTHY_STRINGS = ["1", "true", "yes"] as const;

export function isEnvTruthyString(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined || raw === "") {
    return defaultValue;
  }
  return (ENV_TRUTHY_STRINGS as readonly string[]).includes(raw.trim().toLowerCase());
}

/** Default migrate-mongo changelog collection (keep in sync with `migrate-mongo-config.js`) */
export const DEFAULT_MONGO_MIGRATE_CHANGELOG_NAME = "mongo_migrate_changelog";

/** Gateway / tracing */
export const HEADER_X_REQUEST_ID = "x-request-id";
export const HEADER_X_ADMIN_KEY = "x-admin-key";
export const SCHEMA_MIN_STRING_LENGTH = 1;
export const HELLO_QUERY_NAME_MAX_LENGTH = 100;
export const ECHO_BODY_TEXT_MAX_LENGTH = 500;
export const DEFAULT_HELLO_NAME = "world";

/** Join Zod issue `path` segments for JSON error `details` */
export const ZOD_ISSUE_PATH_SEPARATOR = ".";

/** Log threshold: server-side / unhandled failures */
export const HTTP_STATUS_SERVER_ERROR_MIN = 500;

/** Liveness endpoint JSON body */
export const HEALTH_LIVENESS_BODY = { ok: true } as const;

/** `express.urlencoded` — `false` uses `querystring` (no nested objects via `qs`) */
export const EXPRESS_URLENCODED_EXTENDED = false;
