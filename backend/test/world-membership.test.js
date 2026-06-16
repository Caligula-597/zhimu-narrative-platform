import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, playerUserId } from "./helpers/fixture-ids.js";

test("GET /api/worlds includes membership labels for collaborators", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 200);
  const rows = response.json();
  assert.ok(rows.length >= 1);
  const owned = rows.find((row) => row.membership_role === "owner");
  assert.ok(owned, "host fixture should own at least one world");
  assert.equal(owned.membership_label, "拥有者");
  assert.equal(owned.can_edit_content, true);
  assert.equal(owned.can_manage_world, true);
  assert.ok(Array.isArray(owned.membership_capabilities));
});

test("viewer cannot PATCH world metadata", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const suffix = `${Date.now()}-${Math.round(Math.random() * 10_000)}`;
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ($1, $2, 'viewer permission fixture', 'testing')
     RETURNING id`,
    [hostUserId, `权限测试 ${suffix}`]
  );
  context.after(async () => {
    await query(`DELETE FROM world_members WHERE world_id = $1`, [world.rows[0].id]);
    await query(`DELETE FROM worlds WHERE id = $1`, [world.rows[0].id]);
  });
  await query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'viewer')`,
    [world.rows[0].id, playerUserId]
  );

  const patch = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${world.rows[0].id}`,
    headers: { "x-user-id": playerUserId },
    payload: { name: "不应成功" }
  });
  assert.equal(patch.statusCode, 403);
  assert.equal(patch.json().code, "WORLD_EDITOR_REQUIRED");
  assert.match(patch.json().error, /编辑权限/);
});

test("non-member receives WORLD_ACCESS_DENIED on GET world detail", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const suffix = `${Date.now()}`;
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ($1, $2, 'access denied fixture', 'testing')
     RETURNING id`,
    [hostUserId, `隔离测试 ${suffix}`]
  );
  context.after(async () => {
    await query(`DELETE FROM world_members WHERE world_id = $1`, [world.rows[0].id]);
    await query(`DELETE FROM worlds WHERE id = $1`, [world.rows[0].id]);
  });
  await query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [
    world.rows[0].id,
    hostUserId
  ]);

  const response = await app.inject({
    method: "GET",
    url: `/api/worlds/${world.rows[0].id}`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().code, "WORLD_ACCESS_DENIED");
});
