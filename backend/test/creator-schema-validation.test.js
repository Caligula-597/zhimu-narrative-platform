import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const fogWorldId = "08646748-e4ae-446a-a5e7-ce59ca23ffc3";

test("studio create scene rejects empty name via schema", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${fogWorldId}/scenes`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "" }
  });
  assert.equal(response.statusCode, 400);
});

test("creator create role rejects missing sequence", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${fogWorldId}/roles`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "测试角色" }
  });
  assert.equal(response.statusCode, 400);
});

test("rules create rejects invalid mode enum", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${fogWorldId}/rules`,
    headers: { "x-user-id": hostUserId },
    payload: {
      name: "bad-mode-rule",
      mode: "magic",
      conditions: { all: [] },
      actions: []
    }
  });
  assert.equal(response.statusCode, 400);
});

test("rules create accepts actions array with unlock_scene", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const studio = await app.inject({
    method: "GET",
    url: `/api/worlds/${fogWorldId}/studio`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(studio.statusCode, 200);
  const roleId = studio.json().roles?.[0]?.id;
  const sectionId = studio.json().sections?.[0]?.id;
  const scene = await app.inject({
    method: "POST",
    url: `/api/worlds/${fogWorldId}/scenes`,
    headers: { "x-user-id": hostUserId },
    payload: { name: `schema scene ${Date.now()}` }
  });
  assert.equal(scene.statusCode, 201);
  assert.ok(roleId && sectionId, "fixture world needs roles and sections for rule validation");
  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${fogWorldId}/rules`,
    headers: { "x-user-id": hostUserId },
    payload: {
      name: `schema rule ${Date.now()}`,
      mode: "manual",
      conditions: {
        all: [{ type: "reading_completed", roleSlotId: roleId, scriptSectionId: sectionId }]
      },
      actions: [{ type: "unlock_scene", sceneId: scene.json().id }]
    }
  });
  assert.equal(response.statusCode, 201, response.body);
  assert.ok(Array.isArray(response.json().actions));
  await app.inject({
    method: "DELETE",
    url: `/api/worlds/${fogWorldId}/rules/${response.json().id}`,
    headers: { "x-user-id": hostUserId }
  });
  await app.inject({
    method: "DELETE",
    url: `/api/worlds/${fogWorldId}/studio-nodes/scene/${scene.json().id}`,
    headers: { "x-user-id": hostUserId }
  });
});

test("story edge rejects invalid relationType", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${fogWorldId}/story-edges`,
    headers: { "x-user-id": hostUserId },
    payload: {
      fromType: "scene",
      fromId: "00000000-0000-4000-8000-000000000001",
      toType: "clue",
      toId: "00000000-0000-4000-8000-000000000002",
      relationType: "invalid"
    }
  });
  assert.equal(response.statusCode, 400);
});

test("pipeline evaluate accepts narrative-first payload without spec or proposal", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${fogWorldId}/story-assistant/deepseek/pipeline/evaluate`,
    headers: { "x-user-id": hostUserId },
    payload: {
      setting: { theme: "测试", playerCount: 4, chapterCount: 3, wordsPerChapter: 8000 },
      synopsis: { body: "纲要正文" },
      config: { chapterKeys: ["ch1", "ch2", "ch3"], playerCount: 4, chapterCount: 3 },
      rolesMeta: { roles: [{ key: "role-1", name: "角色A", publicProfile: "公开", privateProfile: "秘密" }] },
      sections: { "role-1": { ch1: { title: "分幕", body: "中".repeat(500) } } },
      narrativeChapters: [{ chapterKey: "ch1", title: "第一章", narrativeBody: "中".repeat(3000) }]
    }
  });
  const body = response.json();
  assert.notEqual(body.code, "VALIDATION_ERROR", body.error || response.body);
});

test("pipeline evaluate accepts explicit null proposal from narrative-first session", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${fogWorldId}/story-assistant/deepseek/pipeline/evaluate`,
    headers: { "x-user-id": hostUserId },
    payload: {
      setting: { theme: "测试", playerCount: 4, chapterCount: 3, wordsPerChapter: 8000 },
      synopsis: { body: "纲要正文" },
      config: { chapterKeys: ["ch1"], playerCount: 4 },
      rolesMeta: { roles: [{ key: "role-1", name: "角色A", publicProfile: "公开", privateProfile: "秘密" }] },
      sections: { "role-1": { ch1: { title: "分幕", body: "中".repeat(500) } } },
      narrativeChapters: [{ chapterKey: "ch1", title: "第一章", narrativeBody: "中".repeat(3000) }],
      proposal: null
    }
  });
  assert.notEqual(response.statusCode, 400, response.body);
  assert.notEqual(response.json().code, "FST_ERR_VALIDATION", response.body);
});
