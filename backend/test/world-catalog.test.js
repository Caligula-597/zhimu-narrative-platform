import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, playerUserId, fixtureWorldId } from "./helpers/fixture-ids.js";

async function withCatalogListed(worldId, run) {
  const prior = await query(
    `SELECT catalog_public, catalog_review_status, name FROM worlds WHERE id = $1`,
    [worldId]
  );
  await query(
    `UPDATE worlds SET catalog_public = true, catalog_review_status = 'approved' WHERE id = $1`,
    [worldId]
  );
  try {
    return await run(prior.rows[0]?.name ?? "公开测试剧本");
  } finally {
    await query(
      `UPDATE worlds
       SET catalog_public = $2,
           catalog_review_status = $3,
           updated_at = now()
       WHERE id = $1`,
      [worldId, prior.rows[0]?.catalog_public ?? false, prior.rows[0]?.catalog_review_status ?? "none"]
    );
  }
}

async function createCatalogReadyWorld(app, nameSuffix) {
  const created = await app.inject({
    method: "POST",
    url: "/api/worlds/from-template/classic-script",
    headers: { "x-user-id": hostUserId },
    payload: { name: `审核就绪 ${nameSuffix}` }
  });
  assert.equal(created.statusCode, 201, created.body);
  const worldId = created.json().world.id;
  const readiness = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/publish-readiness`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(readiness.json().summary.readyForCatalog, true, readiness.body);
  return worldId;
}

test("GET /worlds/catalog lists approved public worlds", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await createCatalogReadyWorld(app, `list-${Date.now()}`);
  await withCatalogListed(worldId, async (worldName) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/worlds/catalog",
      headers: { "x-user-id": playerUserId }
    });
    assert.equal(response.statusCode, 200);
    const rows = response.json();
    const listed = rows.find((row) => row.id === worldId);
    assert.ok(listed, "approved world should appear in catalog");
    assert.equal(listed.name, worldName);
    assert.ok(listed.owner_display_name);
  });
});

test("owner cannot self-publish to catalog; can withdraw", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const denied = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${fixtureWorldId}/catalog`,
    headers: { "x-user-id": playerUserId },
    payload: { catalogPublic: false }
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.json().code, "WORLD_OWNER_REQUIRED");

  const blocked = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${fixtureWorldId}/catalog`,
    headers: { "x-user-id": hostUserId },
    payload: { catalogPublic: true }
  });
  assert.equal(blocked.statusCode, 403);
  assert.equal(blocked.json().code, "CATALOG_SELF_PUBLISH_DISABLED");

  await withCatalogListed(fixtureWorldId, async () => {
    const withdraw = await app.inject({
      method: "PATCH",
      url: `/api/worlds/${fixtureWorldId}/catalog`,
      headers: { "x-user-id": hostUserId },
      payload: { catalogPublic: false }
    });
    assert.equal(withdraw.statusCode, 200);
    assert.equal(withdraw.json().catalog_public, false);
    assert.equal(withdraw.json().catalog_review_status, "none");
  });
});

test("POST /worlds/:id/catalog/request submits pending review", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  process.env.EMAIL_DELIVERY_STUB = "1";
  const worldId = await createCatalogReadyWorld(app, Date.now());

  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/catalog/request`,
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
    url: `/api/worlds/${worldId}/catalog/request`,
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

test("POST /worlds/:id/catalog/request stays pending when notify email fails", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  delete process.env.EMAIL_DELIVERY_STUB;
  const prevResend = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "";
  context.after(() => {
    if (prevResend === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevResend;
  });
  const worldId = await createCatalogReadyWorld(app, `email-${Date.now()}`);

  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/catalog/request`,
    headers: { "x-user-id": hostUserId },
    payload: {
      playtestNotes: "三人完整跑通开始体验流程，分幕与角色正常。",
      themeNotes: "悬疑推理题材，无真实人物影射，无色情暴力描写。",
      agreed: true
    }
  });
  assert.equal(response.statusCode, 201, response.body);
  assert.equal(response.json().catalog_review_status, "pending");
});

test("POST /worlds/:id/catalog/join grants viewer membership and a personal room", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await createCatalogReadyWorld(app, `join-${Date.now()}`);
  await withCatalogListed(worldId, async (worldName) => {
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
      url: `/api/worlds/${worldId}/catalog/join`,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(join.statusCode, 201);
    const payload = join.json();
    assert.equal(payload.worldId, worldId);
    assert.equal(payload.worldName, worldName);
    assert.equal(payload.membershipRole, "viewer");
    assert.ok(payload.room?.invite_code);
    const firstRoomId = payload.room.id;

    const joinAgain = await app.inject({
      method: "POST",
      url: `/api/worlds/${worldId}/catalog/join`,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(joinAgain.statusCode, 201);
    assert.equal(joinAgain.json().room.id, firstRoomId, "catalog join should reuse the same room");

    const membership = await query(
      `SELECT role FROM world_members WHERE world_id = $1 AND user_id = $2`,
      [worldId, user.id]
    );
    assert.equal(membership.rows[0].role, "viewer");

    const studio = await app.inject({
      method: "GET",
      url: `/api/worlds/${worldId}/studio`,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(studio.statusCode, 200, studio.body);
    const studioBody = studio.json();
    assert.equal(studioBody.world.name, worldName);
    assert.ok(studioBody.roles.length >= 1, "roles should be visible to catalog viewer");
    assert.equal(studioBody.chapters.length, 0, "catalog viewers must not see chapters");
    assert.equal(studioBody.sections.length, 0, "catalog viewers must not see script sections");
    assert.equal(studioBody.roles[0].private_profile, "", "viewer must not see private_profile");
    assert.equal((studioBody.scenes || []).length, 0, "catalog viewers must not see scenes");
    assert.equal((studioBody.clues || []).length, 0, "catalog viewers must not see clues");
  });
});
