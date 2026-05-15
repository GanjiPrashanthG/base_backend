# mayday-api

Node **26** + **TypeScript** (ESM, `NodeNext`) + **Express 5** + **Prisma** (MongoDB) + **Zod** + **Pino** (`pino-http`) starter.

## Prerequisites

- [nvm](https://github.com/nvm-sh/nvm) (or another way to run Node 26+)
- **`DATABASE_URL`** (or `MONGODB_URI` + `MONGODB_DB_NAME`) for `npm run build` / `prisma generate` — the Prisma CLI reads it from the environment or `.env`.

## Setup

```bash
nvm use
npm install
# After clone, optional: git hooks run `npm run lint` on commit (requires a git repo)
cp .env.example .env   # optional if you already have a local `.env`
npm run docker:up      # MongoDB only (Docker Compose)
npm run db:push        # optional: apply `prisma/schema.prisma` to your Mongo database
npm run verify         # build, boot server once, HTTP + DB checks
npm run dev            # watch mode
```

## Scripts

| Script        | Description                                      |
| ------------- | ------------------------------------------------ |
| `npm run dev` | Watch mode with [`tsx`](https://github.com/privatenumber/tsx) |
| `npm run build` | `prisma generate` + compile to `dist/` with `tsc` |
| `npm start`   | Run compiled app (`node dist/server.js`)        |
| `npm run typecheck` | Typecheck without emit                    |
| `npm run lint` | ESLint (flat config)                         |
| `npm run format` | Prettier write                              |
| `npm test` | `node:test` + Supertest against the HTTP app   |
| `npm run db:push` | `prisma db push` (sync schema to Mongo)      |
| `npm run mongo:migrate` | Apply pending [`migrate-mongo`](https://github.com/seppevs/migrate-mongo) scripts |
| `npm run mongo:migrate:status` | Show migration status                         |
| `npm run mongo:migrate:down` | Roll back last migration batch                |
| `npm run mongo:migrate:create` | Create migration (pass name after `--`)       |
| `npm run version:validate` | Assert `package.json` `version` is valid [SemVer 2.0.0](https://semver.org/) |
| `npm run verify` | Build, boot server briefly, smoke checks on `/`, health, **metrics**, **`/api/v1/*`**, migrations (when Mongo on), DB health |
| `npm run docker:up` | `docker compose up -d` (Mongo on port 27017) |
| `npm run docker:up:api` | `docker compose --profile api up -d --build` (API + Mongo, same image as prod) |
| `npm run docker:down` | `docker compose down`                      |

For the full stack without npm scripts, run: `docker compose --profile api up -d --build`.

Product hardening checklist: [`docs/BACKEND-EXTENSIONS.md`](docs/BACKEND-EXTENSIONS.md).

AWS deploy (VPC → ECR → ECS Fargate → CodePipeline / CodeBuild): [`docs/AWS-CODEPIPELINE-DEPLOY.md`](docs/AWS-CODEPIPELINE-DEPLOY.md) and root [`buildspec.yml`](buildspec.yml).

## MongoDB and Prisma

The app uses **[Prisma ORM 6](https://www.prisma.io/docs/orm/overview/databases/mongodb)** with the MongoDB provider. **Prisma 7 does not support MongoDB yet**; this repo pins `prisma` / `@prisma/client` to **6.19.x** until that changes.

- **`MONGODB_ENABLED`** (default: on): set to `0`, `false`, `no`, or `off` to **skip connecting** and **omit** `/api/db/*` routes (useful when you only want the HTTP API locally).
- **`DATABASE_URL`**: full Mongo connection string for Prisma (see `.env.example`). If unset, it is built from `MONGODB_URI` + `MONGODB_DB_NAME` with `serverSelectionTimeoutMS` and `maxPoolSize` query params.
- **Schema vs migrations**: use **`npm run db:push`** for Prisma models; use **`npm run mongo:migrate`** for versioned Mongo scripts in `mongo/migrations/` ([`migrate-mongo`](https://github.com/seppevs/migrate-mongo), config at repo root). Prisma Migrate is not available for MongoDB.
- When MongoDB is **enabled** and unreachable (for example **ECONNREFUSED** on `127.0.0.1:27017`), the process **logs a hint** and **exits** before binding HTTP.

Start MongoDB with Compose (from repo root):

```bash
docker compose up -d
```

Equivalent one-off container:

```bash
docker run -d --name mongo -p 27017:27017 mongo:latest
```

Shutdown closes the HTTP server and disconnects Prisma when a connection was opened.

### Mongo migrations (`migrate-mongo`)

**Prisma Migrate does not support MongoDB.** This repo uses:

| Tool | Use for |
| ---- | ------- |
| **`npm run db:push`** | Sync `prisma/schema.prisma` to Mongo (collections / Prisma-level shape). |
| **`npm run mongo:migrate`** | Versioned JS migrations under [`mongo/migrations/`](mongo/migrations/) — indexes, backfills, renames, and other ops not covered by Prisma. |

Commands (require Mongo reachable; same `DATABASE_URL` / `MONGODB_*` as the app):

| Script | Description |
| ------ | ----------- |
| `npm run mongo:migrate` | Apply pending migrations (`migrate-mongo up`). |
| `npm run mongo:migrate:down` | Roll back last batch (`migrate-mongo down`). |
| `npm run mongo:migrate:status` | List applied vs pending. |
| `npm run mongo:migrate:create -- <name>` | Scaffold a new migration file. |

Config lives in [`migrate-mongo-config.js`](migrate-mongo-config.js) at the repo root (ESM). Changelog collections default to **`mongo_migrate_changelog`** / **`mongo_migrate_lock`** (override name with **`MONGO_MIGRATE_CHANGELOG_NAME`** — keep in sync with the app). The HTTP API **`GET /api/v1/migrations`** reads the same changelog collection (see README / [`docs/BACKEND-EXTENSIONS.md`](docs/BACKEND-EXTENSIONS.md)).

The production **Dockerfile** prunes devDependencies, so **`migrate-mongo` is not in the runtime image**. Run `npm run mongo:migrate` from CI, a release job, or a one-off ops container that has the repo and `npm ci` (dev deps installed).

### Docker image (API)

[`Dockerfile`](Dockerfile) builds the Node app (multi-stage: `prisma generate`, `tsc`, production `node_modules`). Use the same image locally, in CI, and in production; point `DATABASE_URL` at your Mongo instance.

## Versioning (SemVer)

The npm standard is **Semantic Versioning 2.0.0** in `package.json` → [`version`](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#version) (`MAJOR.MINOR.PATCH`, optional prerelease / build metadata per [semver.org](https://semver.org/)).

- **Local / CI:** `npm run version:validate` (uses the [`semver`](https://www.npmjs.com/package/semver) package, same family npm uses).
- **Releases:** use a git tag **`v` + version**, e.g. `v1.0.0` must match `package.json` `"1.0.0"`. Bump with [`npm version`](https://docs.npmjs.com/cli/v11/commands/npm-version) (`patch` / `minor` / `major`), then push the tag.

Workflows:

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — runs `version:validate` on every push/PR.
- [`.github/workflows/version.yml`](.github/workflows/version.yml) — runs on **`workflow_dispatch`** and on **`push` tags `v*`**: validates SemVer and checks the tag matches `package.json`.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on push and PR: `npm ci`, **`npm run version:validate`**, typecheck, lint, build, test, `npm run mongo:migrate:status`, and verify (with a MongoDB service container).

## Environment

Copy `.env.example` to `.env` and adjust (optional — defaults work for local dev).

| Variable   | Description                         | Default        |
| ---------- | ----------------------------------- | -------------- |
| `NODE_ENV` | `development` \| `production` \| `test` | `development` |
| `HOST`     | Bind address                        | `127.0.0.1`    |
| `PORT`     | HTTP port                           | `3000`         |
| `LOG_PRETTY` | Set to `1` or `true` to force `pino-pretty` in production | (off in production) |
| `MONGODB_ENABLED` | `1` / `true` connect (default); `0` / `false` / `no` / `off` skip Mongo and DB routes | enabled |
| `DATABASE_URL` | Prisma Mongo URL (overrides URI+name build) | (built from vars below) |
| `MONGODB_URI` | Mongo host URI (no database path) | `mongodb://127.0.0.1:27017` |
| `MONGODB_DB_NAME` | Database name segment | `mayday` |
| `CORS_ORIGIN` | Comma-separated allowed origins; omit in production to deny cross-origin | (none) |
| `JSON_BODY_LIMIT_MB` | `express.json` / `urlencoded` body size cap | `1` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `900000` (15 min) |
| `RATE_LIMIT_MAX` | Max requests per IP per window | `300` |
| `TRUST_PROXY_HOPS` | Express `trust proxy` (forwarded hop count); use `1` behind a single reverse proxy so rate limits see real client IPs | `0` |
| `HTTP_REQUEST_TIMEOUT_MS` | Node `server.requestTimeout` (slow clients / hung requests) | `60000` |
| `HTTP_HEADERS_TIMEOUT_MS` | Node `server.headersTimeout` (must be ≥ request timeout) | `65000` |
| `SHUTDOWN_GRACE_MS` | Max wait for HTTP close + Prisma disconnect after SIGINT/SIGTERM before forced exit | `15000` |
| `ADMIN_API_KEY` | Protects `GET …/migrations` (and **`GET /metrics`** when **`METRICS_REQUIRE_AUTH=1`**); use `X-Admin-Key` or `Authorization: Bearer`. In production, migrations return **401** until this is set. | (unset) |
| `MONGO_MIGRATE_CHANGELOG_NAME` | Mongo collection for [`migrate-mongo`](https://github.com/seppevs/migrate-mongo) changelog (must match `migrate-mongo-config.js`) | `mongo_migrate_changelog` |
| `METRICS_REQUIRE_AUTH` | When `1` / `true` / `yes`, **`GET /metrics`** requires **`ADMIN_API_KEY`** (same headers as migrations) in all environments | `false` |
| `SENTRY_DSN` | Optional [Sentry](https://docs.sentry.io/) DSN (see [`docs/BACKEND-EXTENSIONS.md`](docs/BACKEND-EXTENSIONS.md)) | (unset) |
| `SENTRY_RELEASE` | Optional release identifier for Sentry (for example `mayday-api@<git-sha>`) | (unset) |
| `SENTRY_ENABLE_LOGS` | `1` / `true` / `yes`: send structured logs to Sentry (`enableLogs`) | `false` |
| `SENTRY_SEND_DEFAULT_PII` | `1` / `true` / `yes`: allow default PII on Sentry events (e.g. IP) | `false` |
| `SENTRY_ENABLE_PROFILING` | `1` / `true` / `yes`: enable **`@sentry/profiling-node`** (`profileLifecycle: trace`, sample rate follows tracing) | `false` |

## API

HTTP routes are mounted at **`/api`** and **`/api/v1`** (identical handlers — prefer **`/api/v1`** for new clients).

- `GET /` — small JSON: service name, version, links (`/health`, `/health/ready`, **`/metrics`**, **`/api/docs`**, **`/api/v1/...`**)
- `GET /health` — `{ "ok": true }` (liveness; does not hit MongoDB)
- `GET /health/ready` — readiness: `{ "ready": true, "database": "ok" \| "disabled" }`; **`503`** if Mongo is enabled but the DB ping fails (for orchestrator readiness probes)
- `GET /metrics` — [Prometheus](https://prometheus.io/) text exposition (default Node/process metrics via [`prom-client`](https://github.com/siimon/prom-client)); set **`METRICS_REQUIRE_AUTH=1`** and **`ADMIN_API_KEY`** to require the same admin headers as migrations
- `GET /api/docs` — [Scalar](https://github.com/scalar/scalar) OpenAPI UI (spec from `/api/v1/openapi.json`; mounted **before** global Helmet so the UI can load scripts)
- `GET /api/v1/openapi.json` (and `/api/openapi.json`) — minimal OpenAPI 3 document
- `GET /api/v1/db/health` — `{ "ok": true, "latencyMs": … }` when Mongo + Prisma are enabled
- `GET /api/v1/migrations` — `{ "collection", "migrations": [{ "fileName", "appliedAt" }] }` from the migrate-mongo changelog in Mongo (**admin**: `ADMIN_API_KEY` + `X-Admin-Key` or Bearer; production returns **401** until configured)
- `GET /api/v1/hello?name=Ada` — optional `name` query (Zod-validated)
- `POST /api/v1/echo` — JSON body `{ "text": "..." }` (Zod-validated)

Unknown routes return **JSON** `404` with a consistent error shape. **`X-Request-Id`** is accepted or generated and echoed on responses. **`compression`** is enabled for large JSON. Rate limiting applies to API traffic (see `src/app.ts` for paths that skip the limiter). Oversized JSON bodies return **413** via the error handler. Optional **`SENTRY_DSN`** initializes Sentry in `server.ts`, registers **`Sentry.setupExpressErrorHandler`** on the app (5xx from **`next(err)`**), and sets tracing sample rates that pull in the SDK’s default **`expressIntegration`** spans; optional **`SENTRY_ENABLE_*`** flags control structured logs, default PII, and **`@sentry/profiling-node`** (see env table).

## Dependency updates

[Dependabot](https://docs.github.com/en/code-security/dependabot) is configured in [`.github/dependabot.yml`](.github/dependabot.yml) for weekly `npm` dependency PRs.

Dependencies were installed with pinned Prisma 6 for MongoDB compatibility. To refresh other packages manually:

```bash
npm outdated
```

Then bump packages intentionally and re-run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
https://mtr-uv.sentry.io/issues/warnings/?guidedStep=1&project=4511391750291456