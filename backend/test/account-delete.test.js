import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureWorldId } from "./helpers/fixture-ids.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

test("account delete preview requires auth", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/api/account/delete/preview" });
  assert.equal(response.statusCode, 401);
});

test("registered user can preview and delete account with display name confirmation", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const email = `delete-me-${Date.now()}@zhimu.local`;
  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, displayName: "待注销测试号", password: "delete-pass-123" }
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const token = registered.json().token;
  const userId = registered.json().user.id;

  const world = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: `注销测试世界 ${Date.now()}`, summary: "test" }
  });
  assert.equal(world.statusCode, 201);

  const preview = await app.inject({
    method: "GET",
    url: "/api/account/delete/preview",
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(preview.statusCode, 200);
  const body = preview.json();
  assert.equal(body.confirmationLabel, "待注销测试号");
  assert.equal(body.canDelete, true);
  assert.equal(body.summary.ownedWorlds.length, 1);

  const wrong = await app.inject({
    method: "POST",
    url: "/api/account/delete",
    headers: { authorization: `Bearer ${token}` },
    payload: { confirmation: "错误名字", acknowledged: true }
  });
  assert.equal(wrong.statusCode, 400);
  assert.equal(wrong.json().code, "ACCOUNT_DELETE_CONFIRMATION_INVALID");

  const deleted = await app.inject({
    method: "POST",
    url: "/api/account/delete",
    headers: { authorization: `Bearer ${token}` },
    payload: { confirmation: "待注销测试号", acknowledged: true }
  });
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.ok(deleted.json().deletedAt);

  const me = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(me.statusCode, 401);

  const userRow = await query(`SELECT id FROM users WHERE id = $1`, [userId]);
  assert.equal(userRow.rowCount, 0);

  const jobRow = await query(
    `SELECT status, storage_purged_count FROM account_delete_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  assert.equal(jobRow.rowCount, 1);
  assert.equal(jobRow.rows[0].status, "completed");
});

test("guest account can delete with display name confirmation", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const guest = await app.inject({
    method: "POST",
    url: "/api/auth/guest",
    payload: { displayName: "注销游客号", deviceLabel: "test" }
  });
  assert.equal(guest.statusCode, 201);
  const token = guest.json().token;
  const userId = guest.json().user.id;

  const deleted = await app.inject({
    method: "POST",
    url: "/api/account/delete",
    headers: { authorization: `Bearer ${token}` },
    payload: { confirmation: "注销游客号", acknowledged: true }
  });
  assert.equal(deleted.statusCode, 200, deleted.body);

  const userRow = await query(`SELECT id FROM users WHERE id = $1`, [userId]);
  assert.equal(userRow.rowCount, 0);
});

test("official example owner cannot delete seeded host account", async (context) => {
  const prev = process.env.OFFICIAL_EXAMPLE_WORLD_ID;
  process.env.OFFICIAL_EXAMPLE_WORLD_ID = fixtureWorldId;
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => {
    if (prev === undefined) delete process.env.OFFICIAL_EXAMPLE_WORLD_ID;
    else process.env.OFFICIAL_EXAMPLE_WORLD_ID = prev;
    return app.close();
  });

  const preview = await app.inject({
    method: "GET",
    url: "/api/account/delete/preview",
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(preview.statusCode, 200);
  assert.equal(preview.json().canDelete, false);
  assert.ok(preview.json().blockers.length >= 1);
});
