import pino from "pino";
import type { Env } from "../config.js";
import {
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
  LOG_PRETTY_ENV_ONE,
  LOG_PRETTY_ENV_TRUE,
  NODE_ENV_PRODUCTION,
  PINO_PRETTY_TARGET,
  PINO_PRETTY_TRANSLATE_TIME,
} from "../constants.js";

function wantsPrettyLogs(env: Env): boolean {
  const logPrettyEnv =
    process.env.LOG_PRETTY === LOG_PRETTY_ENV_ONE || process.env.LOG_PRETTY === LOG_PRETTY_ENV_TRUE;
  return env.NODE_ENV !== NODE_ENV_PRODUCTION || logPrettyEnv;
}

export function createLogger(env: Env): pino.Logger {
  const isProd = env.NODE_ENV === NODE_ENV_PRODUCTION;

  return pino({
    level: isProd ? LOG_LEVEL_INFO : LOG_LEVEL_DEBUG,
    transport: wantsPrettyLogs(env)
      ? {
          target: PINO_PRETTY_TARGET,
          options: { colorize: true, translateTime: PINO_PRETTY_TRANSLATE_TIME },
        }
      : undefined,
  });
}
