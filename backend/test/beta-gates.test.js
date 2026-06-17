import assert from "node:assert/strict";
import { fixtureWorldId } from "./helpers/fixture-ids.js";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";


test("POST /worlds then DELETE succeeds (owner)", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Beta gate world ${Date.now()}`, summary: "ephemeral" }
  });
  assert.equal(created.statusCode, 201, created.body);
  const worldId = created.json().id;

  const deleted = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(deleted.statusCode, 200);
  assert.equal(deleted.json().ok, true);
});

test("POST /worlds/:worldId/members adds collaborator by email", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Member gate ${Date.now()}` }
  });
  assert.equal(created.statusCode, 201);
  const worldId = created.json().id;
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const added = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/members`,
    headers: { "x-user-id": hostUserId },
    payload: { email: "player@zhimu.local", role: "viewer" }
  });
  assert.equal(added.statusCode, 201, added.body);
  assert.equal(added.json().role, "viewer");

  const updated = await app.inject({
    method: "PUT",
    url: `/api/worlds/${worldId}/members/${playerUserId}`,
    headers: { "x-user-id": hostUserId },
    payload: { role: "host" }
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().role, "host");
});

test("POST /rules rejects invalid body via validateRuleBody", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/rules`,
    headers: { "x-user-id": hostUserId },
    payload: {
      name: `invalid rule ${Date.now()}`,
      mode: "manual",
      conditions: { all: [{ type: "item_owned", roleSlotId: "00000000-0000-4000-8000-000000000099", itemId: "00000000-0000-4000-8000-000000000099" }] },
      actions: [{ type: "unlock_scene", sceneId: "00000000-0000-4000-8000-000000000099" }]
    }
  });
  assert.equal(response.statusCode, 422);
  assert.equal(response.json().code, "RULE_BODY_INVALID");
  assert.ok(Array.isArray(response.json().details?.errors));
});

test("POST /rules creates valid rule with real world entities", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const studio = await app.inject({
    method: "GET",
    url: `/api/worlds/${fixtureWorldId}/studio`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(studio.statusCode, 200);
  const roleId = studio.json().roles?.[0]?.id;
  const sectionId = studio.json().sections?.[0]?.id;
  assert.ok(roleId, "fixture world needs at least one role");
  assert.ok(sectionId, "fixture world needs at least one section");

  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/rules`,
    headers: { "x-user-id": hostUserId },
    payload: {
      name: `valid rule ${Date.now()}`,
      mode: "manual",
      conditions: {
        all: [{ type: "reading_completed", roleSlotId: roleId, scriptSectionId: sectionId }]
      },
      actions: [{ type: "timeline_log", message: "Beta gate test rule fired" }]
    }
  });
  assert.equal(response.statusCode, 201, response.body);
  assert.ok(Array.isArray(response.json().actions));

  await app.inject({
    method: "DELETE",
    url: `/api/worlds/${fixtureWorldId}/rules/${response.json().id}`,
    headers: { "x-user-id": hostUserId }
  });
});

test("world member routes reject invalid schema", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const bad = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/members`,
    headers: { "x-user-id": hostUserId },
    payload: { email: "not-an-email", role: "superadmin" }
  });
  assert.equal(bad.statusCode, 400);
});
