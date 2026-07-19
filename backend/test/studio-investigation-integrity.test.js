import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { pool, query } from "../src/db.js";
import { lockInvestigationReferences } from "../src/repositories/studio-investigation-repository.js";
import { fixtureWorldId, hostUserId } from "./helpers/fixture-ids.js";

async function fixtureSceneId(worldId = fixtureWorldId) {
  const result = await query(`SELECT id FROM scenes WHERE world_id = $1 ORDER BY created_at LIMIT 1`, [worldId]);
  assert.ok(result.rowCount, "scene fixture required");
  return result.rows[0].id;
}

test("investigation point names are trimmed and whitespace-only creates are rejected", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const sceneId = await fixtureSceneId();
  const url = `/api/worlds/${fixtureWorldId}/scenes/${sceneId}/investigation-points`;

  const invalid = await app.inject({
    method: "POST",
    url,
    headers: { "x-user-id": hostUserId },
    payload: { name: "   " }
  });
  assert.equal(invalid.statusCode, 400, invalid.body);
  assert.equal(invalid.json().code, "NAME_EMPTY");

  const created = await app.inject({
    method: "POST",
    url,
    headers: { "x-user-id": hostUserId },
    payload: { name: "  可疑抽屉  ", description: "测试" }
  });
  assert.equal(created.statusCode, 201, created.body);
  assert.equal(created.json().name, "可疑抽屉");
  context.after(() => query(`DELETE FROM investigation_points WHERE id = $1`, [created.json().id]));

  const patched = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${fixtureWorldId}/investigation-points/${created.json().id}`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "  已整理抽屉  " }
  });
  assert.equal(patched.statusCode, 200, patched.body);
  assert.equal(patched.json().name, "已整理抽屉");
});

test("investigation point patch rejects every cross-world reference without bumping revision", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const localSceneId = await fixtureSceneId();
  const point = await query(
    `INSERT INTO investigation_points (world_id, scene_id, name)
     VALUES ($1, $2, 'scope-integrity-point')
     RETURNING id`,
    [fixtureWorldId, localSceneId]
  );
  context.after(() => query(`DELETE FROM investigation_points WHERE id = $1`, [point.rows[0].id]));

  const foreignWorld = await query(
    `INSERT INTO worlds (owner_user_id, name) VALUES ($1, $2) RETURNING id`,
    [hostUserId, `investigation-foreign-${Date.now()}`]
  );
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [foreignWorld.rows[0].id]));
  await query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [foreignWorld.rows[0].id, hostUserId]
  );
  const foreignScene = await query(
    `INSERT INTO scenes (world_id, name) VALUES ($1, 'foreign-scene') RETURNING id`,
    [foreignWorld.rows[0].id]
  );
  const foreignClue = await query(
    `INSERT INTO clues (world_id, name) VALUES ($1, 'foreign-clue') RETURNING id`,
    [foreignWorld.rows[0].id]
  );
  const foreignItem = await query(
    `INSERT INTO items (world_id, name) VALUES ($1, 'foreign-item') RETURNING id`,
    [foreignWorld.rows[0].id]
  );
  const foreignRole = await query(
    `INSERT INTO role_slots (world_id, name, sequence) VALUES ($1, 'foreign-role', 1) RETURNING id`,
    [foreignWorld.rows[0].id]
  );
  const revisionBefore = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [fixtureWorldId]);
  const url = `/api/worlds/${fixtureWorldId}/investigation-points/${point.rows[0].id}`;
  const cases = [
    [{ sceneId: foreignScene.rows[0].id }, "SCENE_WORLD_MISMATCH", 404],
    [{ clueId: foreignClue.rows[0].id }, "CLUE_WORLD_MISMATCH", 404],
    [{ requiredItemId: foreignItem.rows[0].id }, "ITEM_NOT_FOUND", 404],
    [{ requiredRoleSlotId: foreignRole.rows[0].id }, "ROLE_SLOT_WORLD_MISMATCH", 400]
  ];

  for (const [payload, code, statusCode] of cases) {
    const response = await app.inject({
      method: "PATCH",
      url,
      headers: { "x-user-id": hostUserId },
      payload
    });
    assert.equal(response.statusCode, statusCode, response.body);
    assert.equal(response.json().code, code);
  }

  const revisionAfter = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [fixtureWorldId]);
  assert.equal(revisionAfter.rows[0].content_revision, revisionBefore.rows[0].content_revision);
  const stored = await query(
    `SELECT scene_id, clue_id, required_item_id, required_role_slot_id
     FROM investigation_points WHERE id = $1`,
    [point.rows[0].id]
  );
  assert.equal(stored.rows[0].scene_id, localSceneId);
  assert.equal(stored.rows[0].clue_id, null);
  assert.equal(stored.rows[0].required_item_id, null);
  assert.equal(stored.rows[0].required_role_slot_id, null);
});

test("investigation point world index is installed for snapshot and readiness queries", async () => {
  const index = await query(
    `SELECT indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'idx_investigation_points_world_scene_sequence'`
  );
  assert.equal(index.rowCount, 1);
  assert.match(index.rows[0].indexdef, /\(world_id, scene_id, sequence, created_at\)/);
});

test("reference validation holds a key-share lock until the revision transaction ends", async (context) => {
  const scene = await query(
    `INSERT INTO scenes (world_id, name) VALUES ($1, $2) RETURNING id`,
    [fixtureWorldId, `reference-lock-${Date.now()}`]
  );
  context.after(() => query(`DELETE FROM scenes WHERE id = $1`, [scene.rows[0].id]));
  const locker = await pool.connect();
  const contender = await pool.connect();
  try {
    await locker.query("BEGIN");
    await lockInvestigationReferences(locker, {
      worldId: fixtureWorldId,
      sceneId: scene.rows[0].id
    });
    await contender.query(`SET lock_timeout = '100ms'`);
    await assert.rejects(
      contender.query(`DELETE FROM scenes WHERE id = $1`, [scene.rows[0].id]),
      (error) => error.code === "55P03"
    );
  } finally {
    await locker.query("ROLLBACK").catch(() => {});
    await contender.query("RESET lock_timeout").catch(() => {});
    locker.release();
    contender.release();
  }
});
