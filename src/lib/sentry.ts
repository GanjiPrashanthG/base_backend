import type { Env } from "../config.js";
import { NODE_ENV_PRODUCTION } from "../constants.js";

export type SentryModule = typeof import("@sentry/node");

export async function initSentryIfConfigured(env: Env): Promise<SentryModule | undefined> {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) {
    return undefined;
  }

  const Sentry = await import("@sentry/node");
  const isProd = env.NODE_ENV === NODE_ENV_PRODUCTION;
  const tracesSampleRate = isProd ? 0.05 : 1.0;

  let profilingOptions: Record<string, unknown> = {};
  if (env.SENTRY_ENABLE_PROFILING) {
    const { nodeProfilingIntegration } = await import("@sentry/profiling-node");
    profilingOptions = {
      integrations: [nodeProfilingIntegration()],
      profileSessionSampleRate: tracesSampleRate,
      profileLifecycle: "trace",
    };
  }

  const release = env.SENTRY_RELEASE?.trim();
  Sentry.init({
    dsn,
    environment: env.NODE_ENV,
    ...(release ? { release } : {}),
    tracesSampleRate,
    enableLogs: env.SENTRY_ENABLE_LOGS,
    sendDefaultPii: env.SENTRY_SEND_DEFAULT_PII,
    ...profilingOptions,
  });

  return Sentry;
}
