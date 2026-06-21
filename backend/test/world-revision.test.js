import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureWorldId } from "./helpers/fixture-ids.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

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
