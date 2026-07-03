import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, playerUserId } from "./helpers/fixture-ids.js";

test("GET /api/platform/import-guide returns supported formats", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/platform/import-guide" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.title, "导入前说明");
  assert.ok(body.supportedFormats.length >= 3);
  assert.ok(body.willNotGenerate.some((line) => /平行/.test(line)));
});

test("GET /api/worlds/:id/publish-readiness requires membership", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const suffix = `${Date.now()}`;
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ($1, $2, 'readiness fixture', 'testing')
     RETURNING id`,
    [hostUserId, `就绪检查 ${suffix}`]
  );
  context.after(async () => {
    await query(`DELETE FROM world_members WHERE world_id = $1`, [world.rows[0].id]);
    await query(`DELETE FROM worlds WHERE id = $1`, [world.rows[0].id]);
  });
  await query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [
    world.rows[0].id,
    hostUserId
  ]);

  const denied = await app.inject({
    method: "GET",
    url: `/api/worlds/${world.rows[0].id}/publish-readiness`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.json().code, "WORLD_ACCESS_DENIED");

  const ok = await app.inject({
    method: "GET",
    url: `/api/worlds/${world.rows[0].id}/publish-readiness`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().worldId, world.rows[0].id);
  assert.ok(Array.isArray(ok.json().checks));
  assert.ok(ok.json().summary);
  assert.ok(ok.json().checks.every((item) => item.id && item.level));
});

test("GET /api/worlds/:id/creator-checks includes summary", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const worlds = await app.inject({
    method: "GET",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId }
  });
  const worldId = worlds.json()[0]?.id;
  assert.ok(worldId, "host should have a world");

  const response = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/creator-checks`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 200);
  assert.ok(response.json().summary?.counts);
  assert.ok(Array.isArray(response.json().checks));
});

test("GET /api/worlds/:id/clue-audit returns audit report", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const worlds = await app.inject({
    method: "GET",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId }
  });
  const worldId = worlds.json()[0]?.id;
  assert.ok(worldId, "host should have a world");

  const response = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/clue-audit`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.worldId, worldId);
  assert.ok(Array.isArray(body.cards));
  assert.ok(Array.isArray(body.issues));
  assert.ok(body.summary);
  assert.equal(typeof body.score, "number");
});
