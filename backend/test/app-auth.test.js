import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { pool } from "../src/db.js";

test("protected routes reject a spoofed demo header when compatibility is disabled", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());
  const response = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { "x-user-id": "00000000-0000-0000-0000-000000000000" }
  });
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: "Authentication required" });
});

test("production mode ignores the demo header even when it is explicitly enabled", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true, nodeEnv: "production" });
  context.after(() => app.close());
  const response = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { "x-user-id": "154aa8a9-9cd2-4098-90f4-c75e56c0cc53" }
  });
  assert.equal(response.statusCode, 401);
});

test("register schema rejects incomplete payloads before database writes", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "invalid@example.com" }
  });
  assert.equal(response.statusCode, 400);
});

test.after(async () => {
  await pool.end();
});
