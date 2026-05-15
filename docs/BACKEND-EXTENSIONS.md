# Backend template — extensions checklist

This repo ships a **thin** production-ready HTTP core. Use this list when you fork it for a real product.

## Already included

- Express 5, Zod validation, JSON errors, `asyncHandler`, request IDs, compression, Helmet, CORS, body limits, rate limiting (memory store), Prisma + Mongo, readiness + liveness, OpenAPI JSON, **Scalar UI** at **`/api/docs`** (loads spec from `/api/v1/openapi.json`), migrate-mongo + **`GET …/migrations`**, **Prometheus `/metrics`** (optional **`METRICS_REQUIRE_AUTH`** + `ADMIN_API_KEY`), optional **Sentry** (`SENTRY_DSN`), **`/api`** + **`/api/v1`**, Dependabot, CI, Docker, Husky hook.

## Common next steps (not wired by default)

| Area | What to add |
|------|-------------|
| **Auth** | OAuth2/OIDC, JWT, API keys, or session cookies; never roll crypto by hand. |
| **AuthZ** | RBAC/scopes; tenant id on every query for multi-tenant apps. |
| **Rate limit scale-out** | Redis-backed store (`@express-rate-limit/redis` + `ioredis`) so replicas share counters. |
| **Tracing** | OpenTelemetry SDK + exporter (OTLP) for Jaeger/Datadog/Grafana. |
| **Queues** | BullMQ / SQS / PubSub for async work and retries. |
| **Uploads** | Multipart + object storage (S3/GCS) + antivirus scan pipeline. |
| **Webhooks** | HMAC verification, replay protection, idempotency keys. |
| **Contract tests** | Dredd or schemathesis against `openapi.json`. |
| **Pagination** | Cursor-based list conventions + shared Zod schemas. |
| **Secrets** | Vault / cloud secret manager; avoid long-lived secrets in plain `.env` in prod. |
| **K8s** | Helm chart, PDB, HPA, `PodDisruptionBudget`, network policies. |

## Admin migrations API

- **URL:** `GET /api/migrations` and `GET /api/v1/migrations` (same handler).
- **Data:** reads [`migrate-mongo`](https://github.com/seppevs/migrate-mongo) changelog collection (default `mongo_migrate_changelog`; override with `MONGO_MIGRATE_CHANGELOG_NAME`).
- **Auth:** set **`ADMIN_API_KEY`**; send **`X-Admin-Key: <key>`** or **`Authorization: Bearer <key>`**. In **production**, if the key is unset, the route returns **401** until configured. In non-production, missing key allows read (convenience for local dev only).

## Metrics auth

By default **`GET /metrics`** is public (typical when scraped from an internal network). With **`METRICS_REQUIRE_AUTH=1`** and **`ADMIN_API_KEY`**, scrapers must send **`X-Admin-Key`** or **`Authorization: Bearer`**, in every environment (see `mountMetricsRouter` in [`src/app.ts`](../src/app.ts)).

## Sentry

Set **`SENTRY_DSN`** (never commit the value; use `.env` or host secrets). The server calls **`Sentry.setupExpressErrorHandler`** on the Express app (after API routes, before the JSON 404 and error handlers) so **`next(err)`** paths attach request metadata and report **5xx** to Sentry. With **`tracesSampleRate`** in `server.ts`, default integrations include **`expressIntegration`**. Optional **`SENTRY_RELEASE`** groups events by deploy. Optional flags (all default **off** / conservative): **`SENTRY_ENABLE_LOGS=1`** (structured logs to Sentry), **`SENTRY_SEND_DEFAULT_PII=1`** (e.g. IP collection — use only if policy allows), **`SENTRY_ENABLE_PROFILING=1`** (loads **`@sentry/profiling-node`**, **`profileLifecycle: 'trace'`**, session sample rate aligned with tracing).
