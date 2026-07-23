import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";

const LARGE_BASE64 = "A".repeat(1_100_000);

test("document routes accept their schema-sized body past Fastify's global default", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/worlds/00000000-0000-4000-8000-000000000001/documents/parse",
    payload: { filename: "large.txt", dataBase64: LARGE_BASE64 }
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, "AUTH_REQUIRED");
});

test("script-bundle routes accept their schema-sized body past Fastify's global default", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/script-bundle/preview-new-world",
    payload: { filename: "large.zip", dataBase64: LARGE_BASE64 }
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, "AUTH_REQUIRED");
});
