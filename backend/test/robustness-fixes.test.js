import assert from "node:assert/strict";
import { fixtureRoomId, fixtureWorldId } from "./helpers/fixture-ids.js";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { buildRoomCheckpointSnapshot } from "../src/checkpoint-snapshot.js";
import { executeHostEventById } from "../src/routes/host-event-actions.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";



test("second host event execute returns already resolved", async (context) => {
  const role = await query(`SELECT id FROM role_slots WHERE world_id = $1 ORDER BY sequence LIMIT 1`, [fixtureWorldId]);
  const clue = await query(`SELECT id FROM clues WHERE world_id = $1 ORDER BY created_at LIMIT 1`, [fixtureWorldId]);
  assert.ok(role.rowCount && clue.rowCount);

  const inserted = await query(
    `INSERT INTO pending_host_events (room_id, event_key, title, description, actions, status)
     VALUES ($1, $2, 'double execute probe', '', $3::jsonb, 'pending')
     RETURNING id`,
    [
      fixtureRoomId,
      `double-exec-${Date.now()}`,
      JSON.stringify([{ type: "grant_clue", roleSlotId: role.rows[0].id, clueId: clue.rows[0].id, source: "test" }])
    ]
  );
  const eventId = inserted.rows[0].id;

  const first = await executeHostEventById(fixtureRoomId, hostUserId, eventId);
  assert.equal(first.ok, true);

  const second = await executeHostEventById(fixtureRoomId, hostUserId, eventId);
  assert.equal(second.ok, false);
  assert.equal(second.code, "HOST_EVENT_ALREADY_RESOLVED");

  const status = await query(`SELECT status FROM pending_host_events WHERE id = $1`, [eventId]);
  assert.equal(status.rows[0].status, "executed");
});

test("content package import skips duplicate importKey", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Package dedup ${Date.now()}`, summary: "test" }
  });
  const worldId = created.json().id;
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const payload = {
    format: "zhimu-world-package",
    version: 1,
    data: {
      meta: { importKey: `test-key-${Date.now()}` },
      chapters: [{ id: "ch-1", title: "第一章", summary: "", sequence: 1 }],
      roles: [{ id: "role-1", name: "角色A", public_profile: "", private_profile: "", sequence: 1 }],
      sections: [],
      scenes: [{ id: "sc-1", chapter_id: "ch-1", name: "场景", public_text: "", host_text: "" }],
      clues: [],
      investigationPoints: [],
      edges: [],
      rules: []
    }
  };

  const first = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/content-package/import`,
    headers: { "x-user-id": hostUserId },
    payload
  });
  assert.equal(first.statusCode, 201, first.body);

  const second = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/content-package/import`,
    headers: { "x-user-id": hostUserId },
    payload
  });
  assert.equal(second.statusCode, 201, second.body);
  assert.equal(second.json().deduplicated, true);

  const sceneCount = await query(`SELECT count(*)::int AS n FROM scenes WHERE world_id = $1`, [worldId]);
  assert.equal(sceneCount.rows[0].n, 1);
});

test("buildRoomCheckpointSnapshot returns schema v3 without pg client overlap", async () => {
  const snapshot = await buildRoomCheckpointSnapshot(fixtureRoomId);
  assert.ok(snapshot);
  assert.equal(snapshot.schemaVersion, 3);
  assert.ok(Array.isArray(snapshot.players));
  assert.ok(Array.isArray(snapshot.clueOwnership));
});
