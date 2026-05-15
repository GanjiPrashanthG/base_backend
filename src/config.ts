import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import {
  DEFAULT_HOST,
  DEFAULT_HTTP_HEADERS_TIMEOUT_MS,
  DEFAULT_HTTP_REQUEST_TIMEOUT_MS,
  DEFAULT_JSON_BODY_LIMIT_MB,
  DEFAULT_MAX_POOL_SIZE,
  DEFAULT_METRICS_REQUIRE_AUTH,
  DEFAULT_SENTRY_ENABLE_LOGS,
  DEFAULT_SENTRY_ENABLE_PROFILING,
  DEFAULT_SENTRY_SEND_DEFAULT_PII,
  DEFAULT_MONGO_MIGRATE_CHANGELOG_NAME,
  DEFAULT_MONGODB_DB_NAME,
  DEFAULT_MONGODB_URI,
  DEFAULT_NODE_ENV,
  DEFAULT_PORT,
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
  DEFAULT_SHUTDOWN_GRACE_MS,
  DEFAULT_TRUST_PROXY_HOPS,
  EXIT_FAILURE,
  isEnvTruthyString,
  isMongoEnabledFromEnv,
  NODE_ENV_VALUES,
  SCHEMA_MIN_STRING_LENGTH,
} from "./constants.js";

loadDotenv({ quiet: true });

export function buildMongoDatabaseUrl(uri: string, dbName: string): string {
  const base = uri.trim().replace(/\/+$/, "");
  const path = `${base}/${dbName}`;
  const params = new URLSearchParams({
    serverSelectionTimeoutMS: String(DEFAULT_SERVER_SELECTION_TIMEOUT_MS),
    maxPoolSize: String(DEFAULT_MAX_POOL_SIZE),
  });
  return `${path}?${params.toString()}`;
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENV_VALUES).default(DEFAULT_NODE_ENV),
    HOST: z.string().min(SCHEMA_MIN_STRING_LENGTH).default(DEFAULT_HOST),
    PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
    DATABASE_URL: z.string().optional(),
    MONGODB_ENABLED: z
      .string()
      .optional()
      .transform((raw) => isMongoEnabledFromEnv(raw)),
    MONGODB_URI: z.string().min(SCHEMA_MIN_STRING_LENGTH).default(DEFAULT_MONGODB_URI),
    MONGODB_DB_NAME: z.string().min(SCHEMA_MIN_STRING_LENGTH).default(DEFAULT_MONGODB_DB_NAME),
    CORS_ORIGIN: z.string().optional(),
    JSON_BODY_LIMIT_MB: z.coerce.number().positive().default(DEFAULT_JSON_BODY_LIMIT_MB),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(DEFAULT_RATE_LIMIT_WINDOW_MS),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(DEFAULT_RATE_LIMIT_MAX),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(32).default(DEFAULT_TRUST_PROXY_HOPS),
    HTTP_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(DEFAULT_HTTP_REQUEST_TIMEOUT_MS),
    HTTP_HEADERS_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(DEFAULT_HTTP_HEADERS_TIMEOUT_MS),
    SHUTDOWN_GRACE_MS: z.coerce.number().int().positive().default(DEFAULT_SHUTDOWN_GRACE_MS),
    ADMIN_API_KEY: z.string().optional(),
    MONGO_MIGRATE_CHANGELOG_NAME: z
      .string()
      .min(SCHEMA_MIN_STRING_LENGTH)
      .default(DEFAULT_MONGO_MIGRATE_CHANGELOG_NAME),
    SENTRY_DSN: z.string().optional(),
    SENTRY_RELEASE: z.string().optional(),
    SENTRY_ENABLE_LOGS: z
      .string()
      .optional()
      .transform((raw) => isEnvTruthyString(raw, DEFAULT_SENTRY_ENABLE_LOGS)),
    SENTRY_SEND_DEFAULT_PII: z
      .string()
      .optional()
      .transform((raw) => isEnvTruthyString(raw, DEFAULT_SENTRY_SEND_DEFAULT_PII)),
    SENTRY_ENABLE_PROFILING: z
      .string()
      .optional()
      .transform((raw) => isEnvTruthyString(raw, DEFAULT_SENTRY_ENABLE_PROFILING)),
    METRICS_REQUIRE_AUTH: z
      .string()
      .optional()
      .transform((raw) => {
        if (raw === undefined || raw === "") {
          return DEFAULT_METRICS_REQUIRE_AUTH;
        }
        return ["1", "true", "yes"].includes(raw.trim().toLowerCase());
      }),
  })
  .refine((d) => d.HTTP_HEADERS_TIMEOUT_MS >= d.HTTP_REQUEST_TIMEOUT_MS, {
    message: "HTTP_HEADERS_TIMEOUT_MS must be >= HTTP_REQUEST_TIMEOUT_MS (Node.js / reverse-proxy timeouts)",
    path: ["HTTP_HEADERS_TIMEOUT_MS"],
  })
  .transform((d) => {
    const databaseUrl =
      d.DATABASE_URL?.trim() || buildMongoDatabaseUrl(d.MONGODB_URI, d.MONGODB_DB_NAME);
    return { ...d, databaseUrl };
  });

export type Env = z.infer<typeof envSchema>;

export function loadConfig(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    process.exit(EXIT_FAILURE);
  }
  return parsed.data;
}
