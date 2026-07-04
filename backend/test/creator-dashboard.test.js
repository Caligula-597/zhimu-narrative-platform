import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, playerUserId, fixtureWorldId, fixtureRoomId } from "./helpers/fixture-ids.js";
import { buildCreatorDashboard } from "../src/creator-dashboard.js";

test("buildCreatorDashboard returns stable card model", async () => {
  const dashboard = await buildCreatorDashboard({
    worldId: fixtureWorldId,
    actorId: hostUserId
  });
  assert.equal(dashboard.worldId, fixtureWorldId);
  assert.ok(Array.isArray(dashboard.checks));
  assert.ok(dashboard.summary?.counts);
  assert.ok(dashboard.readiness?.label);
  assert.ok(Array.isArray(dashboard.production));
  assert.equal(dashboard.production.length, 6);
  assert.ok(Array.isArray(dashboard.risks));
  assert.ok(dashboard.riskSummary);
  assert.ok(Array.isArray(dashboard.nextActions));
  assert.ok(dashboard.storage?.usedBytes >= 0);
  for (const item of dashboard.production) {
    assert.ok(item.label && item.ref?.type);
  }
  for (const risk of dashboard.risks) {
    assert.ok(["error", "warning", "success"].includes(risk.level));
    assert.ok(risk.title && risk.detail);
  }
});

test("GET /api/worlds/:id/creator-dashboard requires membership", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const denied = await app.inject({
    method: "GET",
    url: `/api/worlds/${fixtureWorldId}/creator-dashboard`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(denied.statusCode, 403);

  const ok = await app.inject({
    method: "GET",
    url: `/api/worlds/${fixtureWorldId}/creator-dashboard`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(ok.statusCode, 200);
  const body = ok.json();
  assert.equal(body.worldId, fixtureWorldId);
  assert.ok(body.readiness);
  assert.ok(body.production?.length === 6);
});

test("GET /api/worlds/:id/creator-dashboard accepts optional roomId", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: `/api/worlds/${fixtureWorldId}/creator-dashboard?roomId=${fixtureRoomId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.runtime?.roomId, fixtureRoomId);
  assert.equal(typeof body.runtime?.pendingEvents, "number");
});

test("GET /api/worlds/:id/creator-dashboard rejects foreign room", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const suffix = `${Date.now()}`;
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ($1, $2, 'dash fixture', 'testing')
     RETURNING id`,
    [hostUserId, `Dash ${suffix}`]
  );
  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, 'other room', $3, 'active')
     RETURNING id`,
    [world.rows[0].id, hostUserId, `inv-${suffix}`.slice(0, 12)]
  );
  context.after(async () => {
    await query(`DELETE FROM rooms WHERE id = $1`, [room.rows[0].id]);
    await query(`DELETE FROM world_members WHERE world_id = $1`, [world.rows[0].id]);
    await query(`DELETE FROM worlds WHERE id = $1`, [world.rows[0].id]);
  });
  await query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [
    world.rows[0].id,
    hostUserId
  ]);

  const response = await app.inject({
    method: "GET",
    url: `/api/worlds/${fixtureWorldId}/creator-dashboard?roomId=${room.rows[0].id}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "ROOM_NOT_FOUND");
});
