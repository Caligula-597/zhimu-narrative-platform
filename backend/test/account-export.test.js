import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { buildAccountExport } from "../src/account-export.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

test("GET /account/export returns metadata bundle for authenticated user", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: "/api/account/export",
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  assert.equal(body.formatVersion, 1);
  assert.equal(body.profile.id, hostUserId);
  assert.ok(body.exportedAt);
  assert.ok(Array.isArray(body.ownedWorlds));
  assert.ok(Array.isArray(body.assets));
  assert.equal(body.profile.password, undefined);
});

test("buildAccountExport rejects unknown user", async () => {
  await assert.rejects(
    () => buildAccountExport("00000000-0000-4000-8000-000000000099"),
    (error) => error.code === "USER_NOT_FOUND"
  );
});

test("GET /account/export requires authentication", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const res = await app.inject({ method: "GET", url: "/api/account/export" });
  assert.equal(res.statusCode, 401);
});
