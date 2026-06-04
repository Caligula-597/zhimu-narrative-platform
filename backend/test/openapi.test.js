import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";

test("GET /api/openapi.json returns OpenAPI document", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/openapi.json" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.openapi, "3.1.0");
  assert.equal(body.info.title, "织幕 API");
  assert.ok(body.paths);
  assert.ok(body.paths["/api/health/live"]);
});

test("story-assistant analyze rejects oversized body via schema", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/worlds/00000000-0000-4000-8000-000000000001/story-assistant/analyze",
    headers: { "x-user-id": "154aa8a9-9cd2-4098-90f4-c75e56c0cc53" },
    payload: { text: "x".repeat(600_000) }
  });
  assert.equal(response.statusCode, 400);
});
