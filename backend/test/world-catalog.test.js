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
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: {
      name: `审核就绪 ${nameSuffix}`,
      settings: { creationType: "murder_mystery" }
    }
  });
  assert.equal(created.statusCode, 201, created.body);
  const worldId = created.json().id;
  const chapter = await query(
    `INSERT INTO chapters (world_id, title, summary, sequence, publication_status, metadata)
     VALUES ($1, '测试公共幕', '用于公开库流程测试', 1, 'testing', '{"proposalKey":"ch1"}'::jsonb)
     RETURNING id`,
    [worldId]
  );
  const role = await query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
     VALUES ($1, '测试角色', '公开身份', '私人信息', 1) RETURNING id`,
    [worldId]
  );
  const script = await query(
    `INSERT INTO character_scripts (role_slot_id, title) VALUES ($1, '测试角色本') RETURNING id`,
    [role.rows[0].id]
  );
  await query(
    `INSERT INTO script_sections
       (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status, metadata)
     VALUES ($1, $2, $3, '测试分幕', '这是一段可供玩家阅读和测试的完整正文。', 1, 'testing', '{"segmentKey":"ch1"}'::jsonb)`,
    [script.rows[0].id, role.rows[0].id, chapter.rows[0].id]
  );
  const scene = await query(
    `INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text)
     VALUES ($1, $2, '测试场景', '玩家可见场景', '主持说明') RETURNING id`,
    [worldId, chapter.rows[0].id]
  );
  const clue = await query(
    `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
     VALUES ($1, '测试线索', '玩家可见线索', '主持解释', 'public', '{"importance":"normal"}'::jsonb)
     RETURNING id`,
    [worldId]
  );
  await query(
    `INSERT INTO investigation_points
       (world_id, scene_id, name, description, interaction_text, result_text, clue_id, sequence)
     VALUES ($1, $2, '测试调查点', '调查说明', '进行调查', '获得测试线索', $3, 1)`,
    [worldId, scene.rows[0].id, clue.rows[0].id]
  );
  await query(
    `INSERT INTO world_segments
       (world_id, segment_key, title, sequence, chapter_id, story, operations)
     VALUES ($1, 'ch1', '测试公共幕', 1, $2,
       '{"beatPlan":{"goal":"完成测试","playerContent":"阅读正文","dmTasks":"推进场景","advanceCondition":"完成调查"}}'::jsonb,
       $3::jsonb)`,
    [worldId, chapter.rows[0].id, JSON.stringify({
      flow: "主持依次开放场景和调查点。",
      hostTruth: "用于公开库流程测试。",
      clueGrants: [{ clueId: clue.rows[0].id, when: "调查完成", roleKey: "" }]
    })]
  );
  await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, '公开库测试房', $3, 'testing')`,
    [worldId, hostUserId, `CAT${String(nameSuffix).replace(/[^a-zA-Z0-9]/g, "").slice(-20)}${Date.now().toString(36)}`.slice(0, 32)]
  );
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
