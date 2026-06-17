import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { computeStoryLayout, STUDIO_LAYOUT_MODES } from "../src/studio-layout.js";
import { fixtureWorldId } from "./helpers/fixture-ids.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

test("computeStoryLayout supports all preset modes", () => {
  const snapshot = {
    chapters: [{ id: "c1", title: "序章", sequence: 1, metadata: {} }],
    scenes: [{ id: "s1", name: "灯塔", chapter_id: "c1", metadata: {} }],
    clues: [{ id: "cl1", name: "信件", metadata: {} }],
    investigationPoints: [{ id: "p1", name: "锁孔", scene_id: "s1", sequence: 1, metadata: {} }],
    items: [{ id: "i1", name: "钥匙", metadata: {} }],
    edges: [{ from_type: "chapter", from_id: "c1", to_type: "scene", to_id: "s1", relation_type: "mainline" }]
  };

  for (const mode of Object.keys(STUDIO_LAYOUT_MODES)) {
    const positions = computeStoryLayout(snapshot, mode);
    assert.equal(positions.length, 5, mode);
    assert.ok(positions.every((entry) => Number.isFinite(entry.x) && Number.isFinite(entry.y)), mode);
    if (mode === "scene-tree") {
      const scene = positions.find((entry) => entry.type === "scene");
      const clue = positions.find((entry) => entry.type === "clue");
      assert.ok(scene && clue && clue.x > scene.x, "scene-tree keeps clue to the right of scene");
    }
  }
});

test("POST story-layout/auto persists positions for all node types", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;

  const chapter = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/chapters`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "自动排布测试章", summary: "测试", sequence: 99 }
  });
  assert.equal(chapter.statusCode, 201);
  const chapterId = chapter.json().id;

  const scene = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/scenes`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "自动排布场景", publicText: "描述", chapterId }
  });
  const sceneId = scene.json().id;

  const auto = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/story-layout/auto`,
    headers: { "x-user-id": hostUserId },
    payload: { mode: "chapter-groups" }
  });
  assert.equal(auto.statusCode, 200, auto.body);
  const body = auto.json();
  assert.equal(body.mode, "chapter-groups");
  assert.ok(body.updated >= 2);

  const studio = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/studio`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(studio.statusCode, 200);
  const chapterRow = studio.json().chapters.find((row) => row.id === chapterId);
  const sceneRow = studio.json().scenes.find((row) => row.id === sceneId);
  assert.ok(chapterRow?.metadata?.graphPosition?.x >= 16);
  assert.ok(sceneRow?.metadata?.graphPosition?.x >= 16);

  await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/studio-nodes/chapter/${chapterId}`,
    headers: { "x-user-id": hostUserId }
  });
});

test("POST story-layout/auto rejects unknown mode", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;

  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/story-layout/auto`,
    headers: { "x-user-id": hostUserId },
    payload: { mode: "radial" }
  });
  assert.equal(response.statusCode, 400);
});
