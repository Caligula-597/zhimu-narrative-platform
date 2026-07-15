import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureWorldId, hostUserId, playerUserId } from "./helpers/fixture-ids.js";

test("creator bootstrap returns the complete editor cockpit and rejects non-members", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const denied = await app.inject({
    method: "GET",
    url: `/api/worlds/${fixtureWorldId}/creator-bootstrap`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(denied.statusCode, 403);

  const response = await app.inject({
    method: "GET",
    url: `/api/worlds/${fixtureWorldId}/creator-bootstrap`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.worldId, fixtureWorldId);
  assert.equal(body.dashboard?.worldId, fixtureWorldId);
  assert.ok(body.bibleSummary?.counts);
  assert.equal(body.workspacePreview?.world?.id, fixtureWorldId);
  assert.ok(Array.isArray(body.workspacePreview?.roles));
  assert.ok(Array.isArray(body.workspacePreview?.chapters));
  assert.equal(body.workspacePreview?.sections?.some((section) => "body" in section), false);
  assert.ok(Array.isArray(body.segments));
  assert.ok(Array.isArray(body.truthClaims));
  assert.ok(Array.isArray(body.roleRelationships));
  assert.ok(Number.isFinite(Date.parse(body.generatedAt)));
});
