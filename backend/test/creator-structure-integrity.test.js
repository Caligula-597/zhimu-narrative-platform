import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureWorldId, hostUserId, playerUserId } from "./helpers/fixture-ids.js";

const actorHeaders = { "x-user-id": hostUserId };

async function createTestWorld(app, context, label) {
  const response = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: actorHeaders,
    payload: { name: `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}` }
  });
  assert.equal(response.statusCode, 201, response.body);
  const worldId = response.json().id;
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [worldId]));
  return worldId;
}

async function createRole(app, worldId, sequence, overrides = {}) {
  return app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/roles`,
    headers: actorHeaders,
    payload: {
      name: `role-${sequence}`,
      publicProfile: `public-${sequence}`,
      privateProfile: `private-${sequence}`,
      sequence,
      ...overrides
    }
  });
}

async function createChapter(app, worldId, sequence, overrides = {}) {
  return app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/chapters`,
    headers: actorHeaders,
    payload: { title: `chapter-${sequence}`, summary: `summary-${sequence}`, sequence, ...overrides }
  });
}

test("partial role edits preserve private profiles and sequence conflicts roll back", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await createTestWorld(app, context, "role-preserve");
  const first = await createRole(app, worldId, 1);
  const second = await createRole(app, worldId, 2);
  assert.equal(first.statusCode, 201, first.body);
  assert.equal(second.statusCode, 201, second.body);
  const roleId = first.json().id;

  const partial = await app.inject({
    method: "PUT",
    url: `/api/worlds/${worldId}/roles/${roleId}`,
    headers: actorHeaders,
    payload: { name: "renamed role", sequence: 1 }
  });
  assert.equal(partial.statusCode, 200, partial.body);
  assert.equal(partial.json().public_profile, "public-1");
  assert.equal(partial.json().private_profile, "private-1");

  const revisionBeforeConflict = await query(
    `SELECT content_revision FROM worlds WHERE id = $1`,
    [worldId]
  );
  const conflict = await app.inject({
    method: "PUT",
    url: `/api/worlds/${worldId}/roles/${roleId}`,
    headers: actorHeaders,
    payload: { name: "must roll back", privateProfile: "must not persist", sequence: 2 }
  });
  assert.equal(conflict.statusCode, 409, conflict.body);
  assert.equal(conflict.json().code, "ROLE_SEQUENCE_CONFLICT");

  const persisted = await query(
    `SELECT name, private_profile, sequence FROM role_slots WHERE id = $1`,
    [roleId]
  );
  assert.deepEqual(persisted.rows[0], {
    name: "renamed role",
    private_profile: "private-1",
    sequence: 1
  });
  const revisionAfterConflict = await query(
    `SELECT content_revision FROM worlds WHERE id = $1`,
    [worldId]
  );
  assert.equal(
    revisionAfterConflict.rows[0].content_revision,
    revisionBeforeConflict.rows[0].content_revision
  );
});

test("concurrent role and chapter sequence collisions return typed conflicts", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await createTestWorld(app, context, "structure-conflict");

  const roles = await Promise.all([
    createRole(app, worldId, 1, { name: "role-a" }),
    createRole(app, worldId, 1, { name: "role-b" })
  ]);
  assert.deepEqual(roles.map((response) => response.statusCode).sort(), [201, 409]);
  assert.equal(roles.find((response) => response.statusCode === 409).json().code, "ROLE_SEQUENCE_CONFLICT");

  const chapters = await Promise.all([
    createChapter(app, worldId, 1, { title: "chapter-a" }),
    createChapter(app, worldId, 1, { title: "chapter-b" })
  ]);
  assert.deepEqual(chapters.map((response) => response.statusCode).sort(), [201, 409]);
  assert.equal(
    chapters.find((response) => response.statusCode === 409).json().code,
    "CHAPTER_SEQUENCE_CONFLICT"
  );
  assert.equal((await query(`SELECT COUNT(*)::int AS value FROM role_slots WHERE world_id = $1`, [worldId])).rows[0].value, 1);
  assert.equal((await query(`SELECT COUNT(*)::int AS value FROM chapters WHERE world_id = $1`, [worldId])).rows[0].value, 1);
});

test("chapter summary-only and concurrent metadata edits preserve existing settings", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await createTestWorld(app, context, "chapter-preserve");
  const created = await createChapter(app, worldId, 1);
  assert.equal(created.statusCode, 201, created.body);
  const chapterId = created.json().id;

  const configured = await app.inject({
    method: "PUT",
    url: `/api/worlds/${worldId}/chapters/${chapterId}`,
    headers: actorHeaders,
    payload: {
      title: "configured chapter",
      summary: "configured summary",
      publicationStatus: "testing",
      unlockRules: { mode: "host_confirm", threshold: 2 },
      metadata: { base: true }
    }
  });
  assert.equal(configured.statusCode, 200, configured.body);

  const summaryOnly = await app.inject({
    method: "PUT",
    url: `/api/worlds/${worldId}/chapters/${chapterId}`,
    headers: actorHeaders,
    payload: { title: "configured chapter", summary: "summary only" }
  });
  assert.equal(summaryOnly.statusCode, 200, summaryOnly.body);
  assert.equal(summaryOnly.json().publication_status, "testing");
  assert.deepEqual(summaryOnly.json().unlock_rules, { mode: "host_confirm", threshold: 2 });
  assert.deepEqual(summaryOnly.json().metadata, { base: true });

  const concurrent = await Promise.all([
    app.inject({
      method: "PUT",
      url: `/api/worlds/${worldId}/chapters/${chapterId}`,
      headers: actorHeaders,
      payload: { title: "configured chapter", metadata: { left: 1 } }
    }),
    app.inject({
      method: "PUT",
      url: `/api/worlds/${worldId}/chapters/${chapterId}`,
      headers: actorHeaders,
      payload: { title: "configured chapter", metadata: { right: 2 } }
    })
  ]);
  assert.ok(concurrent.every((response) => response.statusCode === 200));

  const persisted = await query(
    `SELECT summary, publication_status, unlock_rules, metadata
     FROM chapters WHERE id = $1`,
    [chapterId]
  );
  assert.equal(persisted.rows[0].summary, "summary only");
  assert.equal(persisted.rows[0].publication_status, "testing");
  assert.deepEqual(persisted.rows[0].unlock_rules, { mode: "host_confirm", threshold: 2 });
  assert.deepEqual(persisted.rows[0].metadata, { base: true, left: 1, right: 2 });
});

test("role deletion protects active players and the world's final role slot", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await createTestWorld(app, context, "role-delete-guard");
  const first = await createRole(app, worldId, 1);
  const second = await createRole(app, worldId, 2);
  assert.equal(first.statusCode, 201, first.body);
  assert.equal(second.statusCode, 201, second.body);
  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, 'role delete guard', $3, 'testing') RETURNING id`,
    [worldId, hostUserId, `ROLE-GUARD-${Date.now()}-${Math.random().toString(16).slice(2)}`]
  );
  await query(
    `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id)
     VALUES ($1, $2, 'player', $3)`,
    [room.rows[0].id, playerUserId, first.json().id]
  );

  const inUse = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/roles/${first.json().id}`,
    headers: actorHeaders
  });
  assert.equal(inUse.statusCode, 409, inUse.body);
  assert.equal(inUse.json().code, "ROLE_SLOT_IN_USE");

  await query(`DELETE FROM room_members WHERE room_id = $1 AND user_id = $2`, [room.rows[0].id, playerUserId]);
  const deleted = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/roles/${first.json().id}`,
    headers: actorHeaders
  });
  assert.equal(deleted.statusCode, 200, deleted.body);

  const lastRole = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/roles/${second.json().id}`,
    headers: actorHeaders
  });
  assert.equal(lastRole.statusCode, 409, lastRole.body);
  assert.equal(lastRole.json().code, "LAST_ROLE_SLOT_REQUIRED");
  assert.equal((await query(`SELECT 1 FROM role_slots WHERE id = $1`, [second.json().id])).rowCount, 1);
});

test("cross-world role updates fail without revision or profile drift", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldA = await createTestWorld(app, context, "cross-world-a");
  const worldB = await createTestWorld(app, context, "cross-world-b");
  const foreign = await createRole(app, worldB, 1);
  assert.equal(foreign.statusCode, 201, foreign.body);
  const revisionBefore = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [worldA]);

  const response = await app.inject({
    method: "PUT",
    url: `/api/worlds/${worldA}/roles/${foreign.json().id}`,
    headers: actorHeaders,
    payload: { name: "cross-world overwrite", privateProfile: "leak", sequence: 1 }
  });
  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().code, "ROLE_SLOT_NOT_FOUND");
  const revisionAfter = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [worldA]);
  assert.equal(revisionAfter.rows[0].content_revision, revisionBefore.rows[0].content_revision);
  const persisted = await query(`SELECT name, private_profile FROM role_slots WHERE id = $1`, [foreign.json().id]);
  assert.equal(persisted.rows[0].name, "role-1");
  assert.equal(persisted.rows[0].private_profile, "private-1");
});

test("whitespace-only creator structure fields fail before revision changes", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const role = await query(
    `SELECT id FROM role_slots WHERE world_id = $1 ORDER BY sequence LIMIT 1`,
    [fixtureWorldId]
  );
  assert.ok(role.rowCount);
  const before = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [fixtureWorldId]);
  const requests = [
    app.inject({
      method: "POST",
      url: `/api/worlds/${fixtureWorldId}/roles`,
      headers: actorHeaders,
      payload: { name: "   ", sequence: 9999 }
    }),
    app.inject({
      method: "POST",
      url: `/api/worlds/${fixtureWorldId}/chapters`,
      headers: actorHeaders,
      payload: { title: "\t", sequence: 9999 }
    }),
    app.inject({
      method: "POST",
      url: `/api/worlds/${fixtureWorldId}/roles/${role.rows[0].id}/sections`,
      headers: actorHeaders,
      payload: { title: "   ", body: "   ", sequence: 9999 }
    })
  ];
  const responses = await Promise.all(requests);
  assert.ok(responses.every((response) => response.statusCode === 400));
  assert.ok(responses.every((response) => response.json().code === "VALIDATION_ERROR"));
  const after = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [fixtureWorldId]);
  assert.equal(after.rows[0].content_revision, before.rows[0].content_revision);
});

test("non-editor collaborators cannot mutate roles or chapters", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await createTestWorld(app, context, "structure-permission");
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      displayName: "Structure Viewer",
      email: `structure-viewer-${suffix}@example.invalid`,
      password: "test-pass-123"
    }
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const { token, user } = registered.json();
  context.after(() => query(`DELETE FROM users WHERE id = $1`, [user.id]));
  await query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'viewer')`,
    [worldId, user.id]
  );
  const headers = { authorization: `Bearer ${token}` };

  const [role, chapter] = await Promise.all([
    app.inject({
      method: "POST",
      url: `/api/worlds/${worldId}/roles`,
      headers,
      payload: { name: "forbidden role", sequence: 1 }
    }),
    app.inject({
      method: "POST",
      url: `/api/worlds/${worldId}/chapters`,
      headers,
      payload: { title: "forbidden chapter", sequence: 1 }
    })
  ]);
  for (const response of [role, chapter]) {
    assert.equal(response.statusCode, 403, response.body);
    assert.equal(response.json().code, "WORLD_EDITOR_REQUIRED");
  }
  assert.equal((await query(`SELECT COUNT(*)::int AS value FROM role_slots WHERE world_id = $1`, [worldId])).rows[0].value, 0);
  assert.equal((await query(`SELECT COUNT(*)::int AS value FROM chapters WHERE world_id = $1`, [worldId])).rows[0].value, 0);
});

test("active-role lookup index is installed", async () => {
  const index = await query(
    `SELECT indexdef FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'idx_room_members_role_active'`
  );
  assert.equal(index.rowCount, 1);
  assert.match(index.rows[0].indexdef, /role_slot_id, room_id/);
  assert.match(index.rows[0].indexdef, /status = 'active'/);
  const fixtureRole = await query(
    `SELECT id FROM role_slots WHERE world_id = $1 ORDER BY sequence LIMIT 1`,
    [fixtureWorldId]
  );
  assert.ok(fixtureRole.rowCount);
});
