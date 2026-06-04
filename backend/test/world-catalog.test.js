import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, playerUserId } from "./helpers/fixture-ids.js";

const fogWorldId = "08646748-e4ae-446a-a5e7-ce59ca23ffc3";

test("GET /worlds/catalog lists public worlds including 雾港来信", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  await query(`UPDATE worlds SET catalog_public = true WHERE id = $1`, [fogWorldId]);
  const response = await app.inject({
    method: "GET",
    url: "/api/worlds/catalog",
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(response.statusCode, 200);
  const rows = response.json();
  const fog = rows.find((row) => row.id === fogWorldId);
  assert.ok(fog, "seed world should appear in catalog");
  assert.equal(fog.name, "雾港来信");
  assert.ok(fog.owner_display_name);
});

test("only world owner can toggle catalog visibility", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const denied = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${fogWorldId}/catalog`,
    headers: { "x-user-id": playerUserId },
    payload: { catalogPublic: false }
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.json().code, "WORLD_OWNER_REQUIRED");

  const allowed = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${fogWorldId}/catalog`,
    headers: { "x-user-id": hostUserId },
    payload: { catalogPublic: true }
  });
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.json().catalog_public, true);
});

test("POST /worlds/:id/catalog/join grants host membership and a personal room", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  await query(`UPDATE worlds SET catalog_public = true WHERE id = $1`, [fogWorldId]);
  const email = `catalog-player-${Date.now()}@example.invalid`;
  const register = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { displayName: "公开库体验者", email, password: "test-pass-123" }
  });
  assert.equal(register.statusCode, 201);
  const { token, user } = register.json();

  const join = await app.inject({
    method: "POST",
    url: `/api/worlds/${fogWorldId}/catalog/join`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(join.statusCode, 201);
  const payload = join.json();
  assert.equal(payload.worldId, fogWorldId);
  assert.equal(payload.worldName, "雾港来信");
  assert.equal(payload.membershipRole, "host");
  assert.ok(payload.room?.invite_code);
  const firstRoomId = payload.room.id;

  const joinAgain = await app.inject({
    method: "POST",
    url: `/api/worlds/${fogWorldId}/catalog/join`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(joinAgain.statusCode, 201);
  assert.equal(joinAgain.json().room.id, firstRoomId, "catalog join should reuse the same room");

  const membership = await query(
    `SELECT role FROM world_members WHERE world_id = $1 AND user_id = $2`,
    [fogWorldId, user.id]
  );
  assert.equal(membership.rows[0].role, "host");

  const studio = await app.inject({
    method: "GET",
    url: `/api/worlds/${fogWorldId}/studio`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(studio.statusCode, 200, studio.body);
  const studioBody = studio.json();
  assert.equal(studioBody.world.name, "雾港来信");
  assert.ok(studioBody.roles.length >= 1, "seed roles should be visible to catalog host");
  assert.ok(studioBody.chapters.length >= 1, "seed chapters should be visible");
  assert.ok(studioBody.sections.length >= 1, "seed sections should be visible");
});
