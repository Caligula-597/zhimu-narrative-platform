import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import {
  fixtureRoomId,
  fixtureWorldId,
  hostUserId,
  playerUserId
} from "./helpers/fixture-ids.js";

async function createForeignWorld(context, prefix) {
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name) VALUES ($1, $2) RETURNING id`,
    [hostUserId, `${prefix}-${Date.now()}`]
  );
  const worldId = world.rows[0].id;
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [worldId]));
  return worldId;
}

async function fixtureRoleIds(limit = 2) {
  const result = await query(
    `SELECT id FROM role_slots WHERE world_id = $1 ORDER BY sequence LIMIT $2`,
    [fixtureWorldId, limit]
  );
  assert.equal(result.rowCount, limit, `${limit} role fixtures required`);
  return result.rows.map((row) => row.id);
}

test("private actions reject cross-world references and target-visible actions without targets", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const foreignWorldId = await createForeignWorld(context, "private-action-foreign");
  const foreignSegment = await query(
    `INSERT INTO world_segments (world_id, segment_key, title)
     VALUES ($1, 'foreign-private-action-segment', 'foreign')
     RETURNING id`,
    [foreignWorldId]
  );
  const foreignRole = await query(
    `INSERT INTO role_slots (world_id, name, sequence)
     VALUES ($1, 'foreign-target', 1)
     RETURNING id`,
    [foreignWorldId]
  );
  const marker = `private-scope-${Date.now()}`;
  const request = (payload) => app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/private-actions`,
    headers: { "x-user-id": playerUserId },
    payload: { actionType: "secret_action", title: marker, ...payload }
  });

  const segmentMismatch = await request({ segmentId: foreignSegment.rows[0].id });
  assert.equal(segmentMismatch.statusCode, 400, segmentMismatch.body);
  assert.equal(segmentMismatch.json().code, "SEGMENT_WORLD_MISMATCH");

  const roleMismatch = await request({ targetRoleSlotId: foreignRole.rows[0].id });
  assert.equal(roleMismatch.statusCode, 400, roleMismatch.body);
  assert.equal(roleMismatch.json().code, "ROLE_SLOT_WORLD_MISMATCH");

  const missingTarget = await request({ visibility: "actor_target_host" });
  assert.equal(missingTarget.statusCode, 400, missingTarget.body);
  assert.equal(missingTarget.json().code, "PRIVATE_ACTION_TARGET_REQUIRED");

  const stored = await query(
    `SELECT 1 FROM room_private_actions WHERE room_id = $1 AND title = $2`,
    [fixtureRoomId, marker]
  );
  assert.equal(stored.rowCount, 0);
});

test("private action reviews enforce transitions and suppress duplicate timeline and SSE", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const marker = `private-transition-${Date.now()}`;
  const submit = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/private-actions`,
    headers: { "x-user-id": playerUserId },
    payload: { actionType: "ask_host", title: marker }
  });
  assert.equal(submit.statusCode, 201, submit.body);
  const actionId = submit.json().action.id;
  context.after(() => query(`DELETE FROM room_private_actions WHERE id = $1`, [actionId]));
  context.after(() => query(
    `DELETE FROM timeline_logs WHERE metadata->>'actionId' = $1`,
    [actionId]
  ));
  context.after(() => query(
    `DELETE FROM event_outbox
     WHERE audience_id = $1 AND payload->>'actionId' = $2`,
    [fixtureRoomId, actionId]
  ));

  const review = () => app.inject({
    method: "PATCH",
    url: `/api/rooms/${fixtureRoomId}/host/private-actions/${actionId}`,
    headers: { "x-user-id": hostUserId },
    payload: { status: "accepted", hostResponse: "允许执行" }
  });
  const first = await review();
  const duplicate = await review();
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(duplicate.statusCode, 200, duplicate.body);

  const invalid = await app.inject({
    method: "PATCH",
    url: `/api/rooms/${fixtureRoomId}/host/private-actions/${actionId}`,
    headers: { "x-user-id": hostUserId },
    payload: { status: "seen" }
  });
  assert.equal(invalid.statusCode, 409, invalid.body);
  assert.equal(invalid.json().code, "PRIVATE_ACTION_TRANSITION_INVALID");

  const [timeline, outbox, stored] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS count
       FROM timeline_logs
       WHERE event_type = 'private_action_status_updated'
         AND metadata->>'actionId' = $1`,
      [actionId]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM event_outbox
       WHERE audience_id = $1
         AND event_type = 'room.private_action_updated'
         AND payload->>'actionId' = $2`,
      [fixtureRoomId, actionId]
    ),
    query(`SELECT status, host_response FROM room_private_actions WHERE id = $1`, [actionId])
  ]);
  assert.equal(timeline.rows[0].count, 1);
  assert.equal(outbox.rows[0].count, 1);
  assert.equal(stored.rows[0].status, "accepted");
  assert.equal(stored.rows[0].host_response, "允许执行");
});

test("segment writes reject cross-world, mismatched and duplicate references without revision drift", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const foreignWorldId = await createForeignWorld(context, "segment-ref-foreign");
  const foreignChapter = await query(
    `INSERT INTO chapters (world_id, title, sequence) VALUES ($1, 'foreign chapter', 1) RETURNING id`,
    [foreignWorldId]
  );
  const foreignScene = await query(
    `INSERT INTO scenes (world_id, name) VALUES ($1, 'foreign scene') RETURNING id`,
    [foreignWorldId]
  );
  const localScene = await query(
    `INSERT INTO scenes (world_id, name) VALUES ($1, $2) RETURNING id`,
    [fixtureWorldId, `local-segment-ref-${Date.now()}`]
  );
  context.after(() => query(`DELETE FROM scenes WHERE id = $1`, [localScene.rows[0].id]));
  const revisionBefore = await query(
    `SELECT content_revision FROM worlds WHERE id = $1`,
    [fixtureWorldId]
  );
  const request = (suffix, payload) => app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/segments`,
    headers: { "x-user-id": hostUserId },
    payload: { segmentKey: `integrity-${suffix}-${Date.now()}`, title: "integrity", ...payload }
  });

  const chapterMismatch = await request("chapter", { chapterId: foreignChapter.rows[0].id });
  assert.equal(chapterMismatch.statusCode, 404, chapterMismatch.body);
  assert.equal(chapterMismatch.json().code, "CHAPTER_NOT_FOUND");

  const refMismatch = await request("scene", {
    refs: [{ refType: "scene", refId: foreignScene.rows[0].id }]
  });
  assert.equal(refMismatch.statusCode, 400, refMismatch.body);
  assert.equal(refMismatch.json().code, "SEGMENT_REFERENCE_WORLD_MISMATCH");

  const duplicate = await request("duplicate", {
    refs: [1, 2].map(() => ({ refType: "scene", refId: localScene.rows[0].id }))
  });
  assert.equal(duplicate.statusCode, 400, duplicate.body);
  assert.equal(duplicate.json().code, "SEGMENT_REFERENCES_INVALID");

  const revisionAfter = await query(
    `SELECT content_revision FROM worlds WHERE id = $1`,
    [fixtureWorldId]
  );
  assert.equal(revisionAfter.rows[0].content_revision, revisionBefore.rows[0].content_revision);
});

test("role relationships reject self-links and exact retries do not bump world revision", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const [fromRoleSlotId, toRoleSlotId] = await fixtureRoleIds();
  const relationType = `integrity_${Date.now()}`;
  const payload = {
    fromRoleSlotId,
    toRoleSlotId,
    relationType,
    label: "保持不变",
    strength: 2
  };
  const save = (body) => app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/role-relationships`,
    headers: { "x-user-id": hostUserId },
    payload: body
  });
  const first = await save(payload);
  assert.equal(first.statusCode, 201, first.body);
  const relationshipId = first.json().relationship.id;
  context.after(() => query(
    `DELETE FROM world_role_relationships WHERE id = $1`,
    [relationshipId]
  ));
  const duplicate = await save(payload);
  assert.equal(duplicate.statusCode, 201, duplicate.body);
  assert.equal(duplicate.json().relationship.id, relationshipId);
  assert.equal(duplicate.json().content_revision, first.json().content_revision);
  assert.equal("inserted" in duplicate.json().relationship, false);

  const self = await save({ ...payload, toRoleSlotId: fromRoleSlotId });
  assert.equal(self.statusCode, 400, self.body);
  assert.equal(self.json().code, "ROLE_RELATIONSHIP_SELF_INVALID");
  const foreignWorldId = await createForeignWorld(context, "relationship-foreign");
  const foreignRole = await query(
    `INSERT INTO role_slots (world_id, name, sequence)
     VALUES ($1, 'foreign relationship role', 1)
     RETURNING id`,
    [foreignWorldId]
  );
  const foreign = await save({ ...payload, toRoleSlotId: foreignRole.rows[0].id });
  assert.equal(foreign.statusCode, 400, foreign.body);
  assert.equal(foreign.json().code, "ROLE_SLOT_WORLD_MISMATCH");
  const revisionAfter = await query(
    `SELECT content_revision FROM worlds WHERE id = $1`,
    [fixtureWorldId]
  );
  assert.equal(Number(revisionAfter.rows[0].content_revision), first.json().content_revision);
});

test("private-action target index is installed", async () => {
  const index = await query(
    `SELECT indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'idx_room_private_actions_target_visible'`
  );
  assert.equal(index.rowCount, 1);
  assert.match(index.rows[0].indexdef, /room_id, target_role_slot_id, created_at DESC/);
  assert.match(index.rows[0].indexdef, /visibility = 'actor_target_host'/);
});
