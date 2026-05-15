process.env.MONGODB_ENABLED ??= "0";
process.env.DATABASE_URL ??= "mongodb://127.0.0.1:27017/mayday";

import { strict as assert } from "node:assert";
import { before, describe, it } from "node:test";
import pino from "pino";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

describe("HTTP API", () => {
  let app: Express;
  const silent = pino({ level: "silent" });

  before(() => {
    const env = loadConfig();
    app = createApp({ logger: silent, env, mongo: undefined });
  });

  it("GET / returns service metadata", async () => {
    const res = await request(app).get("/").expect(200);
    assert.equal(res.body.service, "mayday-api");
    assert.ok(typeof res.body.version === "string");
    assert.ok(res.body.links?.health);
    assert.ok(res.body.links?.healthReady);
    assert.ok(res.body.links?.migrations);
    assert.ok(res.body.links?.docs);
  });

  it("GET /api/docs serves Scalar HTML", async () => {
    const res = await request(app).get("/api/docs").expect(200);
    assert.ok(/<!doctype html/i.test(res.text) || /<html/i.test(res.text));
  });

  it("GET /metrics exposes Prometheus text", async () => {
    const res = await request(app).get("/metrics").expect(200);
    assert.ok(res.text.includes("# HELP"));
  });

  it("GET /api/v1/hello", async () => {
    const res = await request(app).get("/api/v1/hello?name=test").expect(200);
    assert.ok(typeof res.body.message === "string");
  });

  it("GET /api/migrations returns 404 when MongoDB is not mounted", async () => {
    await request(app).get("/api/migrations").expect(404);
  });

  it("GET /health", async () => {
    await request(app).get("/health").expect(200, { ok: true });
  });

  it("GET /health/ready (database skipped in this suite)", async () => {
    const res = await request(app).get("/health/ready").expect(200);
    assert.equal(res.body.ready, true);
    assert.equal(res.body.database, "disabled");
  });

  it("GET /missing returns JSON 404", async () => {
    const res = await request(app).get("/this-route-does-not-exist").expect(404);
    assert.equal(res.body.error, "not_found");
  });
});
