import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureWorldId, hostUserId } from "./helpers/fixture-ids.js";

test("structured document import creates private draft objects and is idempotent", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const marker = `结构导入-${Date.now()}`;
  const payload = {
    target: "structured",
    creationType: "murder_mystery",
    rightsConfirmed: true,
    document: {
      filename: `${marker}.docx`,
      text: [
        `# 角色：${marker}-角色`,
        "这是一段只进入角色草稿的私人正文。",
        `# 角色：${marker}-角色`,
        "同名角色标题再次出现时应保留正文，但不能重复创建角色席位。",
        `# 第一幕 ${marker}-开场`,
        "这是绑定到角色和公共幕的私人分幕正文。",
        `## 场景：${marker}-码头`,
        "场景内容只写入主持说明。",
        `## 线索：${marker}-钥匙`,
        "线索内容在复核前不得公开。",
        `## 秘密：${marker}-真相`,
        "秘密写入作者真相库。"
      ].join("\n"),
      sections: [{ title: marker, body: "schema compatibility" }]
    }
  };

  const first = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/documents/import`,
    headers: { "x-user-id": hostUserId },
    payload
  });
  assert.equal(first.statusCode, 201, first.body);
  const imported = first.json();
  assert.equal(imported.changed, true);
  assert.deepEqual(imported.created, {
    roles: 1,
    roleSections: 3,
    acts: 1,
    scenes: 1,
    clues: 1,
    secrets: 1
  });
  context.after(async () => {
    const prefix = `${imported.sourceKey}:%`;
    await query(`DELETE FROM scenes WHERE world_id = $1 AND metadata->>'importKey' LIKE $2`, [fixtureWorldId, prefix]);
    await query(`DELETE FROM clues WHERE world_id = $1 AND metadata->>'importKey' LIKE $2`, [fixtureWorldId, prefix]);
    await query(`DELETE FROM world_truth_claims WHERE world_id = $1 AND metadata->>'importKey' LIKE $2`, [fixtureWorldId, prefix]);
    await query(`DELETE FROM chapters WHERE world_id = $1 AND metadata->>'importKey' LIKE $2`, [fixtureWorldId, prefix]);
    await query(`DELETE FROM role_slots WHERE world_id = $1 AND settings->>'importKey' LIKE $2`, [fixtureWorldId, prefix]);
  });

  const safety = await query(
    `SELECT
       (SELECT publication_status FROM chapters WHERE world_id = $1 AND metadata->>'importKey' LIKE $2 LIMIT 1) AS chapter_status,
       (SELECT publication_status FROM script_sections WHERE metadata->>'importKey' LIKE $2 LIMIT 1) AS section_status,
       (SELECT visibility::text FROM clues WHERE world_id = $1 AND metadata->>'importKey' LIKE $2 LIMIT 1) AS clue_visibility,
       (SELECT metadata->>'openStatus' FROM scenes WHERE world_id = $1 AND metadata->>'importKey' LIKE $2 LIMIT 1) AS scene_status`,
    [fixtureWorldId, `${imported.sourceKey}:%`]
  );
  assert.deepEqual(safety.rows[0], {
    chapter_status: "draft",
    section_status: "draft",
    clue_visibility: "host",
    scene_status: "locked"
  });

  const second = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/documents/import`,
    headers: { "x-user-id": hostUserId },
    payload
  });
  assert.equal(second.statusCode, 201, second.body);
  assert.equal(second.json().changed, false);
  assert.ok(Object.values(second.json().created).every((count) => count === 0));
  assert.equal(second.json().content_revision, imported.content_revision);
});

test("structured document import requires an explicit rights confirmation", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/documents/import`,
    headers: { "x-user-id": hostUserId },
    payload: {
      target: "structured",
      document: {
        filename: "unauthorized.md",
        text: "角色：未授权测试",
        sections: [{ title: "未授权测试", body: "正文" }]
      }
    }
  });
  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().code, "IMPORT_RIGHTS_CONFIRMATION_REQUIRED");
});
