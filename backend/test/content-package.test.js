import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { buildImportPreview } from "../src/routes/content-package-helpers.js";
import { buildWorldSnapshot } from "../src/routes/world-helpers.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

async function fogWorldId() {
  const result = await query(`SELECT id FROM worlds WHERE name = '雾港来信' ORDER BY created_at LIMIT 1`);
  assert.ok(result.rowCount, "fog world fixture required");
  return result.rows[0].id;
}

function miniPackage(overrides = {}) {
  const roleId = "11111111-1111-4111-8111-111111111101";
  const chapterId = "11111111-1111-4111-8111-111111111102";
  const sectionId = "11111111-1111-4111-8111-111111111103";
  const sceneId = "11111111-1111-4111-8111-111111111104";
  const clueId = "11111111-1111-4111-8111-111111111105";
  const pointId = "11111111-1111-4111-8111-111111111106";
  return {
    format: "zhimu-world-package",
    version: 1,
    data: {
      world: { name: "测试导入包", summary: "来自 P1-4 测试" },
      roles: [{ id: roleId, name: "测试角色", public_profile: "公开", private_profile: "秘密", sequence: 1 }],
      chapters: [{ id: chapterId, title: "测试章节", summary: "摘要", sequence: 1, publication_status: "draft", unlock_rules: {} }],
      sections: [{ id: sectionId, role_slot_id: roleId, chapter_id: chapterId, title: "测试分幕", body: "正文", sequence: 1, publication_status: "draft" }],
      scenes: [{ id: sceneId, chapter_id: chapterId, name: "测试场景", public_text: "场景", host_text: "", metadata: {} }],
      clues: [{ id: clueId, name: "测试线索", public_text: "线索", host_text: "", visibility: "role", metadata: {} }],
      investigationPoints: [{ id: pointId, scene_id: sceneId, clue_id: clueId, name: "测试调查点", description: "描述", result_text: "结果", sequence: 1, metadata: {} }],
      edges: [{ from_type: "scene", from_id: sceneId, to_type: "clue", to_id: clueId, relation_type: "extension", label: "测试连线" }],
      rules: [{
        name: "测试规则",
        mode: "automatic",
        priority: 100,
        enabled: true,
        conditions: { all: [{ type: "clue_read", clueId }] },
        actions: [{ type: "grant_clue", clueId, roleSlotId: roleId }]
      }],
      items: [],
      rooms: [],
      ...overrides
    }
  };
}

test("export summary endpoint returns entity counts", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fogWorldId();
  const response = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/content-package/summary`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(body.roles >= 1);
  assert.ok(body.chapters >= 1);
  assert.ok(typeof body.hasAttachments === "boolean");
});

test("import preview detects duplicate names and missing refs", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fogWorldId();
  const snapshot = await buildWorldSnapshot(worldId);
  const existingRoleName = snapshot.roles[0].name;
  const pkg = miniPackage();
  pkg.data.roles[0].name = existingRoleName;

  const appendPreview = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/content-package/preview`,
    headers: { "x-user-id": hostUserId },
    payload: pkg
  });
  assert.equal(appendPreview.statusCode, 200);
  const preview = appendPreview.json();
  assert.ok(preview.warnings.some((item) => item.code === "duplicate_name"));
  assert.equal(preview.summary.roles, 1);

  const broken = miniPackage();
  broken.data.investigationPoints[0].scene_id = "00000000-0000-4000-8000-000000000099";
  const brokenPreview = buildImportPreview(broken.data, { mode: "new_world" });
  assert.ok(brokenPreview.warnings.some((item) => item.code === "missing_scene_ref"));
});

test("append import remaps ids and does not overwrite existing rows", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fogWorldId();
  const before = await query(`SELECT COUNT(*)::int AS count FROM role_slots WHERE world_id = $1`, [worldId]);
  const beforeRoles = before.rows[0].count;

  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/content-package/import`,
    headers: { "x-user-id": hostUserId },
    payload: miniPackage()
  });
  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.imported.roles, 1);
  assert.equal(body.imported.sections, 1);
  assert.ok(Object.keys(body.idMaps.roles).length === 1);
  assert.notEqual(Object.values(body.idMaps.roles)[0], "11111111-1111-4111-8111-111111111101");

  const after = await query(`SELECT COUNT(*)::int AS count FROM role_slots WHERE world_id = $1`, [worldId]);
  assert.equal(after.rows[0].count, beforeRoles + 1);

  const rule = await query(
    `SELECT conditions, actions FROM automation_rules WHERE world_id = $1 AND name = '测试规则' ORDER BY created_at DESC LIMIT 1`,
    [worldId]
  );
  assert.ok(rule.rowCount);
  const conditionClueId = rule.rows[0].conditions.all[0].clueId;
  const actionClueId = rule.rows[0].actions[0].clueId;
  assert.equal(conditionClueId, actionClueId);
  assert.notEqual(conditionClueId, "11111111-1111-4111-8111-111111111105");
});

test("new world import creates isolated world with remapped content", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  await query(`DELETE FROM worlds WHERE name LIKE 'P1-4 导入世界%' AND owner_user_id = $1`, [hostUserId]);
  await query(
    `INSERT INTO storage_quotas (user_id, max_worlds)
     VALUES ($1, 10)
     ON CONFLICT (user_id) DO UPDATE SET max_worlds = GREATEST(storage_quotas.max_worlds, 10)`,
    [hostUserId]
  );
  const response = await app.inject({
    method: "POST",
    url: "/api/worlds/from-content-package",
    headers: { "x-user-id": hostUserId },
    payload: { name: "P1-4 导入世界", data: miniPackage().data }
  });
  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.world.name, "P1-4 导入世界");
  assert.equal(body.imported.roles, 1);

  const roles = await query(`SELECT id, name FROM role_slots WHERE world_id = $1`, [body.world.id]);
  assert.equal(roles.rowCount, 1);
  assert.equal(roles.rows[0].name, "测试角色");

  await query(`DELETE FROM worlds WHERE id = $1`, [body.world.id]);
});

test("import skips broken section refs and returns warnings via API", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fogWorldId();
  const pkg = miniPackage();
  pkg.data.sections[0].role_slot_id = "00000000-0000-4000-8000-000000000099";
  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/content-package/import`,
    headers: { "x-user-id": hostUserId },
    payload: pkg
  });
  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.imported.sections, 0);
  assert.ok((body.warnings ?? []).some((item) => item.title.includes("已跳过分幕")));
});
