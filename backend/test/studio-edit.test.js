import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureWorldId } from "./helpers/fixture-ids.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

test("creator can patch scene clue and investigation point", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;

  const sceneCreate = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/scenes`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "测试场景", publicText: "初始描述", hostText: "主持备注", metadata: { graphPosition: { x: 88, y: 120 } } }
  });
  assert.equal(sceneCreate.statusCode, 201);
  const sceneId = sceneCreate.json().id;

  const scenePatch = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/scenes/${sceneId}`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "修订场景", publicText: "更新后的描述", metadata: { summary: "摘要已改", openStatus: "unlocked" } }
  });
  assert.equal(scenePatch.statusCode, 200);
  assert.equal(scenePatch.json().name, "修订场景");
  assert.equal(scenePatch.json().metadata.summary, "摘要已改");
  assert.deepEqual(scenePatch.json().metadata.graphPosition, { x: 88, y: 120 });

  const clueCreate = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/clues`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "测试线索", publicText: "线索正文", visibility: "role" }
  });
  assert.equal(clueCreate.statusCode, 201);
  const clueId = clueCreate.json().id;

  const cluePatch = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/clues/${clueId}`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "修订线索", publicText: "新正文", visibility: "host", metadata: { clueType: "image", importance: "key" } }
  });
  assert.equal(cluePatch.statusCode, 200);
  assert.equal(cluePatch.json().visibility, "host");
  assert.equal(cluePatch.json().metadata.importance, "key");

  const pointCreate = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/scenes/${sceneId}/investigation-points`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "测试调查点", description: "描述", resultText: "结果", clueId }
  });
  assert.equal(pointCreate.statusCode, 201);
  const pointId = pointCreate.json().id;

  const otherClue = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/clues`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "替换线索", publicText: "另一线索" }
  });
  const otherClueId = otherClue.json().id;

  const pointPatch = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/investigation-points/${pointId}`,
    headers: { "x-user-id": hostUserId },
    payload: { clueId: otherClueId, metadata: { hostConfirmRequired: true, oneTime: false } }
  });
  assert.equal(pointPatch.statusCode, 200);
  assert.equal(pointPatch.json().clue_id, otherClueId);
  assert.equal(pointPatch.json().metadata.hostConfirmRequired, true);

  const refs = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/studio-nodes/clue/${otherClueId}/references`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(refs.statusCode, 200);
  assert.ok(refs.json().clueGrantCount >= 1);

  const sceneRow = await query(`SELECT name, public_text, metadata FROM scenes WHERE id = $1`, [sceneId]);
  assert.equal(sceneRow.rows[0].name, "修订场景");
  assert.equal(sceneRow.rows[0].metadata.summary, "摘要已改");

  const clueRow = await query(`SELECT name, visibility, metadata FROM clues WHERE id = $1`, [clueId]);
  assert.equal(clueRow.rows[0].name, "修订线索");
  assert.equal(clueRow.rows[0].metadata.importance, "key");

  const pointRow = await query(`SELECT clue_id, metadata FROM investigation_points WHERE id = $1`, [pointId]);
  assert.equal(pointRow.rows[0].clue_id, otherClueId);
  assert.equal(pointRow.rows[0].metadata.hostConfirmRequired, true);

  await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/studio-nodes/scene/${sceneId}`,
    headers: { "x-user-id": hostUserId }
  });
});

test("studio writes reject references from another world", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const worldA = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Studio scope A ${Date.now()}`, summary: "a" }
  });
  const worldB = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Studio scope B ${Date.now()}`, summary: "b" }
  });
  assert.equal(worldA.statusCode, 201, worldA.body);
  assert.equal(worldB.statusCode, 201, worldB.body);
  const worldAId = worldA.json().id;
  const worldBId = worldB.json().id;
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = ANY($1::uuid[])`, [[worldAId, worldBId]]);
  });

  const foreignChapter = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldBId}/chapters`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "Foreign chapter", summary: "", sequence: 1 }
  });
  assert.equal(foreignChapter.statusCode, 201, foreignChapter.body);

  const badScene = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldAId}/scenes`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "Bad scene", chapterId: foreignChapter.json().id }
  });
  assert.equal(badScene.statusCode, 404, badScene.body);
  assert.equal(badScene.json().code, "CHAPTER_NOT_FOUND");

  const scene = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldAId}/scenes`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "Local scene" }
  });
  assert.equal(scene.statusCode, 201, scene.body);

  const foreignClue = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldBId}/clues`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "Foreign clue", publicText: "x" }
  });
  assert.equal(foreignClue.statusCode, 201, foreignClue.body);

  const badPoint = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldAId}/scenes/${scene.json().id}/investigation-points`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "Bad point", clueId: foreignClue.json().id }
  });
  assert.equal(badPoint.statusCode, 404, badPoint.body);
  assert.equal(badPoint.json().code, "CLUE_WORLD_MISMATCH");

  const badEdge = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldAId}/story-edges`,
    headers: { "x-user-id": hostUserId },
    payload: {
      fromType: "scene",
      fromId: scene.json().id,
      toType: "clue",
      toId: foreignClue.json().id,
      relationType: "extension"
    }
  });
  assert.equal(badEdge.statusCode, 404, badEdge.body);
  assert.equal(badEdge.json().code, "STUDIO_NODE_NOT_FOUND");

  const badRows = await query(`SELECT id FROM story_graph_edges WHERE world_id = $1`, [worldAId]);
  assert.equal(badRows.rowCount, 0);
});

test("creator can delete chapter and unbind linked scenes", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;

  const chapterCreate = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/chapters`,
    headers: { "x-user-id": hostUserId },
    payload: { title: `删除测试章 ${Date.now()}`, summary: "待删", sequence: 99 }
  });
  assert.equal(chapterCreate.statusCode, 201);
  const chapterId = chapterCreate.json().id;

  const sceneCreate = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/scenes`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "绑定场景", chapterId, publicText: "描述" }
  });
  assert.equal(sceneCreate.statusCode, 201);
  const sceneId = sceneCreate.json().id;

  const refs = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/studio-nodes/chapter/${chapterId}/references`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(refs.statusCode, 200);
  assert.ok(refs.json().sceneCount >= 1);

  const deleted = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/studio-nodes/chapter/${chapterId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(deleted.statusCode, 200);

  const chapterRow = await query(`SELECT id FROM chapters WHERE id = $1`, [chapterId]);
  assert.equal(chapterRow.rowCount, 0);
  const sceneRow = await query(`SELECT chapter_id FROM scenes WHERE id = $1`, [sceneId]);
  assert.equal(sceneRow.rows[0].chapter_id, null);
});

test("deleting chapter renumbers survivors and removes bound sections and rules", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;

  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Chapter reseq ${Date.now()}`, summary: "test" }
  });
  assert.equal(created.statusCode, 201);
  const testWorldId = created.json().id;
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [testWorldId]);
  });

  const ch1 = await app.inject({
    method: "POST",
    url: `/api/worlds/${testWorldId}/chapters`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "序章", summary: "删我", sequence: 1 }
  });
  const ch2 = await app.inject({
    method: "POST",
    url: `/api/worlds/${testWorldId}/chapters`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "第一章", summary: "留我", sequence: 2 }
  });
  const chapter1Id = ch1.json().id;
  const chapter2Id = ch2.json().id;

  const role = await app.inject({
    method: "POST",
    url: `/api/worlds/${testWorldId}/roles`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "测试角色", publicProfile: "p", privateProfile: "s", sequence: 1 }
  });
  const roleId = role.json().id;

  const section = await app.inject({
    method: "POST",
    url: `/api/worlds/${testWorldId}/roles/${roleId}/sections`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "序章分幕", body: "x".repeat(300), chapterId: chapter1Id, sequence: 1 }
  });
  const sectionId = section.json().id;

  await query(
    `INSERT INTO automation_rules (world_id, name, mode, conditions, actions)
     VALUES ($1, '序章读完·自动记录', 'automatic', $2::jsonb, $3::jsonb)`,
    [
      testWorldId,
      JSON.stringify({ all: [{ type: "reading_completed", roleSlotId: roleId, scriptSectionId: sectionId }] }),
      JSON.stringify([{ type: "unlock_scene", sceneId: "00000000-0000-4000-8000-000000000001" }])
    ]
  );

  const deleted = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${testWorldId}/studio-nodes/chapter/${chapter1Id}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(deleted.statusCode, 200);

  const seqRow = await query(`SELECT sequence, title FROM chapters WHERE id = $1`, [chapter2Id]);
  assert.equal(seqRow.rows[0].sequence, 1);
  assert.equal(seqRow.rows[0].title, "第一章");

  const sectionRow = await query(`SELECT id FROM script_sections WHERE id = $1`, [sectionId]);
  assert.equal(sectionRow.rowCount, 0);

  const ruleRow = await query(`SELECT id FROM automation_rules WHERE world_id = $1 AND name LIKE '序章读完%'`, [testWorldId]);
  assert.equal(ruleRow.rowCount, 0);
});

test("GET studio repairs chapter sequence gaps from legacy deletes", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Chapter repair ${Date.now()}`, summary: "test" }
  });
  assert.equal(created.statusCode, 201);
  const testWorldId = created.json().id;
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [testWorldId]);
  });

  const ch1 = await app.inject({
    method: "POST",
    url: `/api/worlds/${testWorldId}/chapters`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "边城暮色", summary: "a", sequence: 2 }
  });
  const ch2 = await app.inject({
    method: "POST",
    url: `/api/worlds/${testWorldId}/chapters`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "暗流涌动", summary: "b", sequence: 3 }
  });
  assert.equal(ch1.statusCode, 201);
  assert.equal(ch2.statusCode, 201);

  const studio = await app.inject({
    method: "GET",
    url: `/api/worlds/${testWorldId}/studio`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(studio.statusCode, 200);
  const sequences = studio.json().chapters.map((chapter) => chapter.sequence);
  assert.deepEqual(sequences, [1, 2]);
});
