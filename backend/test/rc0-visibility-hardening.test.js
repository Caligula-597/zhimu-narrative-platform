import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, playerUserId } from "./helpers/fixture-ids.js";

async function registerUser(app, label) {
  const email = `rc0-${label}-${Date.now()}@example.invalid`;
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { displayName: label, email, password: "test-pass-123" }
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json();
}

test("POST sections rejects roleSlotId from another world", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const ownerA = await registerUser(app, "owner-a");
  const ownerB = await registerUser(app, "owner-b");

  const worldA = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${ownerA.token}` },
    payload: { name: `A-${Date.now()}`, summary: "a" }
  });
  assert.equal(worldA.statusCode, 201, worldA.body);
  const worldAId = worldA.json().id;

  const worldB = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${ownerB.token}` },
    payload: { name: `B-${Date.now()}`, summary: "b" }
  });
  assert.equal(worldB.statusCode, 201, worldB.body);
  const worldBId = worldB.json().id;

  const roleB = await query(
    `INSERT INTO role_slots (world_id, name, sequence) VALUES ($1, '异界角色', 1) RETURNING id`,
    [worldBId]
  );
  const foreignRoleId = roleB.rows[0].id;

  const create = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldAId}/roles/${foreignRoleId}/sections`,
    headers: { authorization: `Bearer ${ownerA.token}` },
    payload: { title: "偷塞", body: "不应写入", sequence: 1, publicationStatus: "draft" }
  });
  assert.equal(create.statusCode, 400, create.body);
  assert.equal(create.json().code, "ROLE_SLOT_WORLD_MISMATCH");
});

test("viewer cannot export content-package or bible core-trick", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const owner = await registerUser(app, "owner");
  const viewer = await registerUser(app, "viewer");

  const world = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${owner.token}` },
    payload: { name: `pkg-${Date.now()}`, summary: "s" }
  });
  assert.equal(world.statusCode, 201, world.body);
  const worldId = world.json().id;

  await query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'viewer')
     ON CONFLICT (world_id, user_id) DO UPDATE SET role = 'viewer'`,
    [worldId, viewer.user.id]
  );

  const pkg = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/content-package`,
    headers: { authorization: `Bearer ${viewer.token}` }
  });
  assert.equal(pkg.statusCode, 403, pkg.body);

  const bible = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/bible/core-trick`,
    headers: { authorization: `Bearer ${viewer.token}` }
  });
  assert.equal(bible.statusCode, 403, bible.body);
});

test("searchWorldContent hides section body snippets for non-editors", async () => {
  const { searchWorldContent } = await import("../src/world-search.js");
  const suffix = Date.now();
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ($1, $2, '', 'testing') RETURNING id`,
    [hostUserId, `search-${suffix}`]
  );
  const worldId = world.rows[0].id;
  const role = await query(
    `INSERT INTO role_slots (world_id, name, sequence) VALUES ($1, 'R', 1) RETURNING id`,
    [worldId]
  );
  await query(
    `INSERT INTO character_scripts (role_slot_id, title) VALUES ($1, '稿') RETURNING id`,
    [role.rows[0].id]
  ).catch(async () => {
    /* may already exist path — ensure section only */
  });
  const script = await query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 LIMIT 1`, [
    role.rows[0].id
  ]);
  let scriptId = script.rows[0]?.id;
  if (!scriptId) {
    const created = await query(
      `INSERT INTO character_scripts (role_slot_id, title) VALUES ($1, '稿') RETURNING id`,
      [role.rows[0].id]
    );
    scriptId = created.rows[0].id;
  }
  await query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, title, body, sequence, publication_status)
     VALUES ($1, $2, '机密标题XYZ', '机密正文UNIQUEBODY999', 1, 'published')`,
    [scriptId, role.rows[0].id]
  );

  try {
    const open = await searchWorldContent(worldId, {
      q: "UNIQUEBODY999",
      includeDraftContent: true
    });
    assert.ok(open.results.some((r) => r.type === "section"));

    const closed = await searchWorldContent(worldId, {
      q: "UNIQUEBODY999",
      includeDraftContent: false
    });
    assert.equal(closed.results.filter((r) => r.type === "section").length, 0);

    const titleOnly = await searchWorldContent(worldId, {
      q: "机密标题XYZ",
      includeDraftContent: false
    });
    const sectionHit = titleOnly.results.find((r) => r.type === "section");
    assert.ok(sectionHit);
    assert.equal(sectionHit.snippet, "");
  } finally {
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  }
});

// keep fixture ids referenced so helpers stay linked in tree-shaken runs
void playerUserId;
