import assert from "node:assert/strict";
import { fixtureWorldId, fixtureRoomId } from "./helpers/fixture-ids.js";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";

async function guestToken(app) {
  const res = await app.inject({ method: "POST", url: "/api/auth/guest", payload: { displayName: "矩阵游客" } });
  assert.equal(res.statusCode, 201, res.body);
  return { token: res.json().token, userId: res.json().user.id };
}

test("permission matrix - core write routes enforce account/world roles", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const guest = await guestToken(app);
  context.after(async () => {
    await query(`DELETE FROM users WHERE id = $1`, [guest.userId]);
  });

  const matrix = [
    {
      name: "guest cannot create world",
      method: "POST",
      url: "/api/worlds",
      headers: { authorization: `Bearer ${guest.token}` },
      body: { name: "Guest world" },
      expectCode: "GUEST_ACCOUNT_RESTRICTED"
    },
    {
      name: "player cannot invite collaborator",
      method: "POST",
      url: `/api/worlds/${fixtureWorldId}/members`,
      headers: { "x-user-id": playerUserId },
      body: { email: "blocked@example.com", role: "editor" },
      expectStatus: 403
    },
    {
      name: "player cannot delete world",
      method: "DELETE",
      url: `/api/worlds/${fixtureWorldId}`,
      headers: { "x-user-id": playerUserId },
      expectStatus: 403
    },
    {
      name: "player cannot patch catalog visibility",
      method: "PATCH",
      url: `/api/worlds/${fixtureWorldId}/catalog`,
      headers: { "x-user-id": playerUserId },
      body: { catalogPublic: true },
      expectCode: "WORLD_OWNER_REQUIRED"
    },
    {
      name: "unauthenticated cannot read world members",
      method: "GET",
      url: `/api/worlds/${fixtureWorldId}/members`,
      expectStatus: 401
    },
    {
      name: "host cannot resend invites (owner only)",
      method: "POST",
      url: `/api/worlds/${fixtureWorldId}/invites/00000000-0000-4000-8000-000000000001/resend`,
      headers: { "x-user-id": playerUserId },
      expectStatus: 403
    }
  ];

  for (const row of matrix) {
    const res = await app.inject({
      method: row.method,
      url: row.url,
      headers: row.headers,
      payload: row.body
    });
    if (row.expectCode) {
      assert.equal(res.statusCode >= 400, true, `${row.name}: ${res.body}`);
      assert.equal(res.json().code, row.expectCode, `${row.name}: ${res.body}`);
    } else {
      assert.equal(res.statusCode, row.expectStatus, `${row.name}: ${res.body}`);
    }
  }
});

test("permission matrix - guest cannot accept world invite", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const guest = await guestToken(app);
  context.after(async () => {
    await query(`DELETE FROM users WHERE id = $1`, [guest.userId]);
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/worlds/invites/accept",
    headers: { authorization: `Bearer ${guest.token}` },
    payload: { token: "a".repeat(32) }
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().code, "GUEST_ACCOUNT_RESTRICTED");
});

test("permission matrix - owner can list members", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: `/api/worlds/${fixtureWorldId}/members`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.json().members));
});

test("permission matrix - viewer studio read is redacted and cannot search drafts", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary)
     VALUES ($1, 'permission-redaction-world', '')
     RETURNING id`,
    [hostUserId]
  );
  const worldId = world.rows[0].id;
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  await query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [worldId, hostUserId]);
  await query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'viewer')`, [worldId, playerUserId]);
  const role = await query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
     VALUES ($1, '测试角色', '公开资料', '不可泄露私密资料', 1)
     RETURNING id`,
    [worldId]
  );
  const script = await query(`INSERT INTO character_scripts (role_slot_id, title) VALUES ($1, '角色私人剧本') RETURNING id`, [role.rows[0].id]);
  await query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, title, body, sequence, publication_status)
     VALUES ($1, $2, '草稿幕', '不可搜索草稿正文', 1, 'draft'),
            ($1, $2, '测试幕', '可见测试正文', 2, 'testing')`,
    [script.rows[0].id, role.rows[0].id]
  );

  const studio = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/studio`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(studio.statusCode, 200, studio.body);
  const studioBody = studio.json();
  assert.equal(studioBody.roles[0].private_profile, "");
  // Catalog viewers only get public role profiles; operational studio content stays internal.
  assert.equal(studioBody.sections.length, 0);
  assert.equal(studioBody.chapters?.length ?? 0, 0);
  assert.equal(studioBody.scenes?.length ?? 0, 0);
  assert.equal(studioBody.clues?.length ?? 0, 0);

  const searchDraft = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/search?q=${encodeURIComponent("不可搜索草稿正文")}`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(searchDraft.statusCode, 403, searchDraft.body);
});

async function createAuditWorld(suffix, extraMembers = []) {
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ($1, $2, 'L1-05 permission audit', 'testing')
     RETURNING id`,
    [hostUserId, `权限抽查 ${suffix}`]
  );
  const worldId = world.rows[0].id;
  await query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [worldId, hostUserId]);
  for (const member of extraMembers) {
    await query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, $3)`, [
      worldId,
      member.userId,
      member.role
    ]);
  }
  return worldId;
}

test("L1-05 permission matrix - catalog ops asset room boundaries", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const previousOps = process.env.OPS_API_TOKEN;
  process.env.OPS_API_TOKEN = "l1-05-permission-audit-token";
  context.after(() => {
    if (previousOps === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = previousOps;
  });

  const suffix = `${Date.now()}`;
  const worldId = await createAuditWorld(suffix, [{ userId: playerUserId, role: "viewer" }]);
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const matrix = [
    {
      name: "non-member cannot read studio",
      method: "GET",
      url: `/api/worlds/${worldId}/studio`,
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000099" },
      expectCode: "WORLD_ACCESS_DENIED"
    },
    {
      name: "viewer cannot request signed upload",
      method: "POST",
      url: "/api/assets/upload-url",
      headers: { "x-user-id": playerUserId },
      body: {
        worldId,
        filename: "blocked.png",
        contentType: "image/png",
        byteSize: 1024
      },
      expectCode: "WORLD_EDITOR_REQUIRED"
    },
    {
      name: "viewer cannot create automation rule",
      method: "POST",
      url: `/api/worlds/${worldId}/rules`,
      headers: { "x-user-id": playerUserId },
      body: {
        name: "blocked rule",
        mode: "automatic",
        conditions: { all: [{ type: "reading_completed", roleSlotId: "x", scriptSectionId: "y" }] },
        actions: [{ type: "timeline_log", message: "nope" }]
      },
      expectCode: "WORLD_EDITOR_REQUIRED"
    },
    {
      name: "viewer cannot submit catalog review",
      method: "POST",
      url: `/api/worlds/${worldId}/catalog/request`,
      headers: { "x-user-id": playerUserId },
      body: { agreed: true, playtestNotes: "不应通过 viewer 提交", themeNotes: "题材说明至少八字" },
      expectCode: "WORLD_OWNER_REQUIRED"
    },
    {
      name: "non-member cannot list world assets",
      method: "GET",
      url: `/api/worlds/${worldId}/assets`,
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000099" },
      expectCode: "WORLD_ACCESS_DENIED"
    },
    {
      name: "player cannot grant clue as host",
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/host/grant-clue`,
      headers: { "x-user-id": playerUserId },
      body: {
        roleSlotId: "00000000-0000-4000-8000-000000000001",
        clueId: "00000000-0000-4000-8000-000000000002"
      },
      expectCode: "HOST_ROLE_REQUIRED"
    },
    {
      name: "ops feedback list requires token",
      method: "GET",
      url: "/api/ops/feedback",
      headers: { "x-user-id": hostUserId },
      expectCode: "OPS_TOKEN_REQUIRED"
    },
    {
      name: "ops feedback rejects wrong token",
      method: "GET",
      url: "/api/ops/feedback/stats",
      headers: { "x-ops-token": "wrong-token-value" },
      expectCode: "OPS_TOKEN_REQUIRED"
    }
  ];

  for (const row of matrix) {
    const res = await app.inject({
      method: row.method,
      url: row.url,
      headers: row.headers,
      payload: row.body
    });
    assert.equal(res.statusCode >= 400, true, `${row.name}: ${res.body}`);
    assert.equal(res.json().code, row.expectCode, `${row.name}: ${res.body}`);
  }

  const hostProgress = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/host-progress`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(hostProgress.statusCode, 200, hostProgress.body);

  const opsOk = await app.inject({
    method: "GET",
    url: "/api/ops/feedback/stats",
    headers: { "x-ops-token": process.env.OPS_API_TOKEN }
  });
  assert.equal(opsOk.statusCode, 200, opsOk.body);
  assert.ok(Array.isArray(opsOk.json()));
});
