import assert from "node:assert/strict";
import test from "node:test";
import AdmZip from "adm-zip";
import { createApp } from "../src/app.js";
import { transaction } from "../src/db.js";
import { bumpWorldRevisionAfterWrite, loadWorldRevision } from "../src/world-revision.js";
import { fixtureWorldId } from "./helpers/fixture-ids.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

function tinyPngBase64() {
  return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
}

function uniquePngBase64(label) {
  // Keep a valid PNG signature while varying bytes so import-key dedupe does not skip revision bumps.
  return Buffer.concat([
    Buffer.from(tinyPngBase64(), "base64"),
    Buffer.from(`\nzhimu-revision-${label}`, "utf8")
  ]).toString("base64");
}

function buildRevisionScriptBundle(label) {
  const zip = new AdmZip();
  zip.addFile(`revision-${label}/人物剧本/测试角色.txt`, Buffer.from("第一幕\n角色正文", "utf8"));
  zip.addFile(`revision-${label}/调查线索/测试线索.png`, Buffer.from(tinyPngBase64(), "base64"));
  return zip.toBuffer();
}

test("PATCH world rejects stale If-Match revision", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;

  const getWorld = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(getWorld.statusCode, 200);
  const revision = Number(getWorld.json().content_revision);
  assert.ok(revision >= 1);

  const ok = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: { summary: `revision test ${Date.now()}` }
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().content_revision, revision + 1);

  const conflict = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: { summary: "should fail" }
  });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().code, "WORLD_VERSION_CONFLICT");
});

test("POST scene bumps world revision when If-Match matches", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;

  const world = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId }
  });
  const revision = Number(world.json().content_revision);

  const sceneCreate = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/scenes`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: { name: "Revision scene", publicText: "x" }
  });
  assert.equal(sceneCreate.statusCode, 201);
  assert.equal(sceneCreate.json().content_revision, revision + 1);
  const sceneId = sceneCreate.json().id;

  const patched = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/scenes/${sceneId}`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision + 1}"` },
    payload: { name: "Revision scene updated" }
  });
  assert.equal(patched.statusCode, 200);
  assert.equal(Number(patched.headers.etag?.replace(/"/g, "")), revision + 2);
});

test("DELETE studio node bumps revision when If-Match matches", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;

  const world = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId }
  });
  const revision = Number(world.json().content_revision);

  const sceneCreate = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/scenes`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: { name: "Delete me scene", publicText: "x" }
  });
  assert.equal(sceneCreate.statusCode, 201);
  const sceneId = sceneCreate.json().id;
  const afterCreateRevision = Number(sceneCreate.json().content_revision);

  const deleted = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/studio-nodes/scene/${sceneId}`,
    headers: { "x-user-id": hostUserId, "if-match": `"${afterCreateRevision}"` }
  });
  assert.equal(deleted.statusCode, 200);
  assert.equal(Number(deleted.json().content_revision), afterCreateRevision + 1);
});

test("POST scene rejects stale If-Match revision", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;

  const world = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId }
  });
  const revision = Number(world.json().content_revision);

  await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: { summary: `bump ${Date.now()}` }
  });

  const conflict = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/scenes`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: { name: "Should conflict", publicText: "x" }
  });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().code, "WORLD_VERSION_CONFLICT");
});

test("revision check serializes concurrent writes with the same If-Match", async () => {
  const worldId = fixtureWorldId;
  const revision = await loadWorldRevision(worldId);

  async function concurrentWrite(label) {
    return transaction((client) =>
      bumpWorldRevisionAfterWrite(worldId, revision, client, async (tx) => {
        await tx.query(`SELECT pg_sleep(0.15)`);
        await tx.query(`UPDATE worlds SET summary = summary WHERE id = $1`, [worldId]);
        return { label };
      })
    );
  }

  const results = await Promise.allSettled([concurrentWrite("a"), concurrentWrite("b")]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1, JSON.stringify(results));
  assert.equal(rejected.length, 1, JSON.stringify(results));
  assert.equal(rejected[0].reason.code, "WORLD_VERSION_CONFLICT");
});

test("studio graph layout writes participate in world revision conflicts", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;

  const world = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId }
  });
  const revision = Number(world.json().content_revision);

  const sceneCreate = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/scenes`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: { name: "Layout revision scene", publicText: "x" }
  });
  assert.equal(sceneCreate.statusCode, 201, sceneCreate.body);
  const sceneId = sceneCreate.json().id;
  const afterCreateRevision = Number(sceneCreate.json().content_revision);

  const position = await app.inject({
    method: "PUT",
    url: `/api/worlds/${worldId}/studio-nodes/scene/${sceneId}/position`,
    headers: { "x-user-id": hostUserId, "if-match": `"${afterCreateRevision}"` },
    payload: { x: 140.4, y: 201.7 }
  });
  assert.equal(position.statusCode, 200, position.body);
  assert.equal(Number(position.json().content_revision), afterCreateRevision + 1);

  const staleLayout = await app.inject({
    method: "PUT",
    url: `/api/worlds/${worldId}/story-layout`,
    headers: { "x-user-id": hostUserId, "if-match": `"${afterCreateRevision}"` },
    payload: { positions: [{ type: "scene", id: sceneId, x: 10, y: 20 }] }
  });
  assert.equal(staleLayout.statusCode, 409, staleLayout.body);
  assert.equal(staleLayout.json().code, "WORLD_VERSION_CONFLICT");

  await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/studio-nodes/scene/${sceneId}`,
    headers: { "x-user-id": hostUserId, "if-match": `"${afterCreateRevision + 1}"` }
  });
});

test("creator bible writes participate in world revision conflicts", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;

  const world = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId }
  });
  const revision = Number(world.json().content_revision);

  const core = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/bible/core-trick`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: { summary: `Bible revision ${Date.now()}`, method: "locked-room" }
  });
  assert.equal(core.statusCode, 200, core.body);
  assert.equal(Number(core.json().content_revision), revision + 1);

  const staleTimeline = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/bible/timeline-events`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: { timeLabel: "23:00", eventSummary: "Should conflict", sequence: 1 }
  });
  assert.equal(staleTimeline.statusCode, 409, staleTimeline.body);
  assert.equal(staleTimeline.json().code, "WORLD_VERSION_CONFLICT");
});

test("platform world structure writes participate in world revision conflicts", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;

  const world = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId }
  });
  const revision = Number(world.json().content_revision);

  const segment = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/segments`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: {
      segmentKey: `revision-segment-${Date.now()}`,
      title: "Revision segment",
      sequence: 99
    }
  });
  assert.equal(segment.statusCode, 201, segment.body);
  assert.equal(Number(segment.json().content_revision), revision + 1);

  const staleClaim = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/truth-claims`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: { title: "Should conflict", claim: "old revision" }
  });
  assert.equal(staleClaim.statusCode, 409, staleClaim.body);
  assert.equal(staleClaim.json().code, "WORLD_VERSION_CONFLICT");
});

test("story manuscript writes participate in world revision conflicts", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;

  const world = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId }
  });
  const revision = Number(world.json().content_revision);

  const saved = await app.inject({
    method: "PUT",
    url: `/api/worlds/${worldId}/story-manuscript`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: { body: `Revision manuscript ${Date.now()}` }
  });
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(Number(saved.json().content_revision), revision + 1);

  const staleSync = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/story-manuscript/sync-from-graph`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: {}
  });
  assert.equal(staleSync.statusCode, 409, staleSync.body);
  assert.equal(staleSync.json().code, "WORLD_VERSION_CONFLICT");
});

test("story assistant imports participate in world revision conflicts", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;
  const suffix = Date.now();

  const world = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId }
  });
  const revision = Number(world.json().content_revision);

  const draftImport = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/story-assistant/import`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: { text: `scene: Revision assistant scene ${suffix}\n\nclue: Revision assistant clue ${suffix}` }
  });
  assert.equal(draftImport.statusCode, 201, draftImport.body);
  assert.equal(Number(draftImport.json().content_revision), revision + 1);

  const staleDeepseekImport = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/story-assistant/deepseek/import`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: {
      proposal: {
        chapters: [{ key: `rev-ch-${suffix}`, title: "Revision chapter" }],
        scenes: [{ key: `rev-scene-${suffix}`, chapterKey: `rev-ch-${suffix}`, name: "Revision scene" }],
        investigationPoints: [],
        clues: [],
        edges: []
      }
    }
  });
  assert.equal(staleDeepseekImport.statusCode, 409, staleDeepseekImport.body);
  assert.equal(staleDeepseekImport.json().code, "WORLD_VERSION_CONFLICT");
});

test("document page imports participate in world revision conflicts", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;
  const suffix = Date.now();

  const studio = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/studio`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(studio.statusCode, 200, studio.body);
  const roleSlotId = studio.json().roles?.[0]?.id;
  assert.ok(roleSlotId, "fixture world needs a role slot");

  const world = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId }
  });
  const revision = Number(world.json().content_revision);
  const contentBase64 = uniquePngBase64(`page-${suffix}`);

  const imported = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/documents/import-pages`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: {
      filename: `revision-page-${suffix}.png`,
      contentType: "image/png",
      contentBase64,
      roleSlotId,
      rightsConfirmed: true,
      title: "Revision page import"
    }
  });
  assert.equal(imported.statusCode, 201, imported.body);
  assert.equal(imported.json().skipped, false, imported.body);
  assert.equal(Number(imported.json().content_revision), revision + 1);
  assert.equal(imported.json().target, "role_script_pages");

  const staleImport = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/documents/import-pages`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: {
      filename: `revision-page-stale-${suffix}.png`,
      contentType: "image/png",
      contentBase64: uniquePngBase64(`page-stale-${suffix}`),
      roleSlotId,
      rightsConfirmed: true,
      title: "Stale revision page import"
    }
  });
  assert.equal(staleImport.statusCode, 409, staleImport.body);
  assert.equal(staleImport.json().code, "WORLD_VERSION_CONFLICT");
});

test("script bundle imports participate in world revision conflicts", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;
  const suffix = Date.now();

  const world = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId }
  });
  const revision = Number(world.json().content_revision);
  const bundle = buildRevisionScriptBundle(`ok-${suffix}`);

  const imported = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/script-bundle/import`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: {
      filename: `revision-bundle-${suffix}.zip`,
      contentBase64: bundle.toString("base64"),
      createMissingRoles: true,
      publicationStatus: "draft"
    }
  });
  assert.equal(imported.statusCode, 201, imported.body);
  assert.equal(Number(imported.json().content_revision), revision + 1);
  assert.equal(imported.json().ok, true);

  const staleBundle = buildRevisionScriptBundle(`stale-${suffix}`);
  const staleImport = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/script-bundle/import`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` },
    payload: {
      filename: `revision-bundle-stale-${suffix}.zip`,
      contentBase64: staleBundle.toString("base64"),
      createMissingRoles: true,
      publicationStatus: "draft"
    }
  });
  assert.equal(staleImport.statusCode, 409, staleImport.body);
  assert.equal(staleImport.json().code, "WORLD_VERSION_CONFLICT");
});
