/**
 * Boots `dist/server.js`, waits for HTTP, hits health endpoints, then stops the child.
 * Expects `.env` (or env) with HOST/PORT; Mongo optional — skips DB check if route returns 404.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.HOST ?? "127.0.0.1";
const port = process.env.PORT ?? "3000";
const base = `http://${host}:${port}`;

const child = spawn("node", ["dist/server.js"], {
  cwd: root,
  env: { ...process.env },
  stdio: ["ignore", "pipe", "pipe"],
});

async function waitForServer(deadlineMs) {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) {
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`server did not become ready within ${deadlineMs}ms (tried ${base}/health)`);
}

function killChild() {
  try {
    child.kill("SIGTERM");
  } catch {
    /* ignore */
  }
}

try {
  await waitForServer(30_000);

  const rootRes = await fetch(`${base}/`);
  if (!rootRes.ok) {
    throw new Error(`/ -> ${rootRes.status}`);
  }
  const rootJson = await rootRes.json();
  if (
    typeof rootJson.service !== "string" ||
    !rootJson.links?.health ||
    !rootJson.links?.healthReady ||
    !rootJson.links?.migrations ||
    !rootJson.links?.docs
  ) {
    throw new Error(`/ unexpected: ${JSON.stringify(rootJson)}`);
  }
  console.log("ok  /");

  const health = await fetch(`${base}/health`);
  if (!health.ok) {
    throw new Error(`/health -> ${health.status}`);
  }
  const healthJson = await health.json();
  if (healthJson.ok !== true) {
    throw new Error(`/health unexpected: ${JSON.stringify(healthJson)}`);
  }
  console.log("ok  /health");

  const ready = await fetch(`${base}/health/ready`);
  if (!ready.ok) {
    throw new Error(`/health/ready -> ${ready.status}`);
  }
  const readyJson = await ready.json();
  if (readyJson.ready !== true) {
    throw new Error(`/health/ready unexpected: ${JSON.stringify(readyJson)}`);
  }
  console.log("ok  /health/ready");

  const metrics = await fetch(`${base}/metrics`);
  if (!metrics.ok) {
    throw new Error(`/metrics -> ${metrics.status}`);
  }
  const metricsBody = await metrics.text();
  if (!metricsBody.includes("process_resident_memory_bytes")) {
    throw new Error("/metrics unexpected: missing default Node metrics");
  }
  console.log("ok  /metrics");

  const docs = await fetch(`${base}/api/docs`);
  if (!docs.ok) {
    throw new Error(`/api/docs -> ${docs.status}`);
  }
  const docsBody = await docs.text();
  if (!/<!doctype html/i.test(docsBody) && !/<html/i.test(docsBody)) {
    throw new Error("/api/docs unexpected: expected HTML document");
  }
  console.log("ok  /api/docs");

  const hello = await fetch(`${base}/api/v1/hello?name=verify`);
  if (!hello.ok) {
    throw new Error(`/api/v1/hello -> ${hello.status}`);
  }
  const helloJson = await hello.json();
  if (typeof helloJson.message !== "string") {
    throw new Error(`/api/v1/hello unexpected: ${JSON.stringify(helloJson)}`);
  }
  console.log("ok  /api/v1/hello");

  const migHeaders = {};
  if (process.env.ADMIN_API_KEY) {
    migHeaders["X-Admin-Key"] = process.env.ADMIN_API_KEY;
  }
  const migrations = await fetch(`${base}/api/v1/migrations`, { headers: migHeaders });
  if (migrations.status === 404) {
    console.log("skip /api/v1/migrations (Mongo disabled or route not mounted)");
  } else {
    if (!migrations.ok) {
      throw new Error(`/api/v1/migrations -> ${migrations.status}`);
    }
    const migJson = await migrations.json();
    if (!Array.isArray(migJson.migrations) || typeof migJson.collection !== "string") {
      throw new Error(`/api/v1/migrations unexpected: ${JSON.stringify(migJson)}`);
    }
    console.log("ok  /api/v1/migrations");
  }

  const db = await fetch(`${base}/api/v1/db/health`);
  if (db.status === 404) {
    console.log("skip /api/v1/db/health (Mongo disabled or route not mounted)");
  } else {
    if (!db.ok) {
      throw new Error(`/api/v1/db/health -> ${db.status}`);
    }
    const dbJson = await db.json();
    if (dbJson.ok !== true || typeof dbJson.latencyMs !== "number") {
      throw new Error(`/api/v1/db/health unexpected: ${JSON.stringify(dbJson)}`);
    }
    console.log("ok  /api/v1/db/health");
  }

  console.log("verify: all checks passed");
} catch (err) {
  console.error("verify: failed", err);
  process.exitCode = 1;
} finally {
  killChild();
  await new Promise((r) => setTimeout(r, 800));
  try {
    child.kill("SIGKILL");
  } catch {
    /* ignore */
  }
}
