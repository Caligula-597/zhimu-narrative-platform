import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, playerUserId } from "./helpers/fixture-ids.js";

const fogWorldId = "08646748-e4ae-446a-a5e7-ce59ca23ffc3";

test("GET /worlds/catalog lists public worlds including 雾港来信", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  await query(
    `UPDATE worlds SET catalog_public = true, catalog_review_status = 'approved' WHERE id = $1`,
    [fogWorldId]
  );
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

test("owner cannot self-publish to catalog; can withdraw", async (context) => {
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

  const blocked = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${fogWorldId}/catalog`,
    headers: { "x-user-id": hostUserId },
    payload: { catalogPublic: true }
  });
  assert.equal(blocked.statusCode, 403);
  assert.equal(blocked.json().code, "CATALOG_SELF_PUBLISH_DISABLED");

  await query(
    `UPDATE worlds SET catalog_public = true, catalog_review_status = 'approved' WHERE id = $1`,
    [fogWorldId]
  );
  const withdraw = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${fogWorldId}/catalog`,
    headers: { "x-user-id": hostUserId },
    payload: { catalogPublic: false }
  });
  assert.equal(withdraw.statusCode, 200);
  assert.equal(withdraw.json().catalog_public, false);
  assert.equal(withdraw.json().catalog_review_status, "none");
});

test("POST /worlds/:id/catalog/request submits pending review", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  process.env.EMAIL_DELIVERY_STUB = "1";
  await query(
    `UPDATE worlds SET catalog_public = false, catalog_review_status = 'none' WHERE id = $1`,
    [fogWorldId]
  );

  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${fogWorldId}/catalog/request`,
    headers: { "x-user-id": hostUserId },
    payload: {
      playtestNotes: "三人完整跑通开始体验流程，分幕与角色正常。",
      themeNotes: "悬疑推理题材，无真实人物影射，无色情暴力描写。",
      sampleNotes: "请重点看序章分幕",
      contact: "wechat-demo",
      agreed: true
    }
  });
  assert.equal(response.statusCode, 201, response.body);
  const body = response.json();
  assert.equal(body.catalog_review_status, "pending");
  assert.ok(body.catalog_review_submitted_at);

  const duplicate = await app.inject({
    method: "POST",
    url: `/api/worlds/${fogWorldId}/catalog/request`,
    headers: { "x-user-id": hostUserId },
    payload: {
      playtestNotes: "再次提交应被拒绝。",
      themeNotes: "悬疑推理题材说明足够长度。",
      agreed: true
    }
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().code, "CATALOG_REVIEW_PENDING");
});

test("POST /worlds/:id/catalog/join grants host membership and a personal room", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  await query(
    `UPDATE worlds SET catalog_public = true, catalog_review_status = 'approved' WHERE id = $1`,
    [fogWorldId]
  );
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
