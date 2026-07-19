import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import {
  fixtureRoomId,
  fixtureWorldId,
  hostUserId
} from "./helpers/fixture-ids.js";
import { queryFixtureRoleId } from "./helpers/fixture-helpers.js";

async function createItem(name, metadata = {}) {
  const result = await query(
    `INSERT INTO items (world_id, name, metadata)
     VALUES ($1, $2, $3::jsonb)
     RETURNING id`,
    [fixtureWorldId, name, JSON.stringify(metadata)]
  );
  return result.rows[0].id;
}

test("host item grants reject cross-world roles and serialize unique inventory", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleSlotId = await queryFixtureRoleId();
  const foreignWorld = await query(
    `INSERT INTO worlds (owner_user_id, name) VALUES ($1, $2) RETURNING id`,
    [hostUserId, `foreign-grant-world-${Date.now()}`]
  );
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [foreignWorld.rows[0].id]));
  const foreignRole = await query(
    `INSERT INTO role_slots (world_id, name, sequence)
     VALUES ($1, 'foreign-role', 1)
     RETURNING id`,
    [foreignWorld.rows[0].id]
  );
  const itemId = await createItem(`unique-race-${Date.now()}`, { unique: true });
  context.after(() => query(`DELETE FROM items WHERE id = $1`, [itemId]));

  const crossWorld = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/grant-item`,
    headers: { "x-user-id": hostUserId },
    payload: { roleSlotId: foreignRole.rows[0].id, itemId }
  });
  assert.equal(crossWorld.statusCode, 400, crossWorld.body);
  assert.equal(crossWorld.json().code, "ROLE_SLOT_WORLD_MISMATCH");

  const grant = (key) => app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/grant-item`,
    headers: { "x-user-id": hostUserId, "idempotency-key": key },
    payload: { roleSlotId, itemId, quantity: 99 }
  });
  const responses = await Promise.all([
    grant(`unique-a-${Date.now()}`),
    grant(`unique-b-${Date.now()}`)
  ]);
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 409]);

  const inventory = await query(
    `SELECT quantity FROM inventory
     WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3`,
    [fixtureRoomId, roleSlotId, itemId]
  );
  assert.equal(inventory.rowCount, 1);
  assert.equal(inventory.rows[0].quantity, 1, "unique item quantity must stay one under concurrency");
});

test("grant-item rolls inventory, audit, timeline and SSE back when rule execution fails", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleSlotId = await queryFixtureRoleId();
  const itemId = await createItem(`atomic-grant-${Date.now()}`);
  context.after(() => query(`DELETE FROM items WHERE id = $1`, [itemId]));
  const rule = await query(
    `INSERT INTO automation_rules
       (world_id, room_id, name, mode, enabled, conditions, actions)
     VALUES ($1, $2, 'host-item-rollback-probe', 'automatic', true, $3::jsonb, $4::jsonb)
     RETURNING id`,
    [
      fixtureWorldId,
      fixtureRoomId,
      JSON.stringify({ all: [{ type: "item_owned", roleSlotId, itemId }] }),
      JSON.stringify([{ type: "grant_clue", roleSlotId, clueId: randomUUID() }])
    ]
  );
  context.after(() => query(`DELETE FROM automation_rules WHERE id = $1`, [rule.rows[0].id]));

  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/grant-item`,
    headers: {
      "x-user-id": hostUserId,
      "idempotency-key": `atomic-grant-${Date.now()}`
    },
    payload: { roleSlotId, itemId }
  });
  assert.equal(response.statusCode, 500, response.body);

  const [inventory, timeline, audit, outbox] = await Promise.all([
    query(
      `SELECT 1 FROM inventory WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3`,
      [fixtureRoomId, roleSlotId, itemId]
    ),
    query(
      `SELECT 1 FROM timeline_logs
       WHERE room_id = $1 AND event_type = 'host_grant_item' AND metadata->>'itemId' = $2`,
      [fixtureRoomId, itemId]
    ),
    query(
      `SELECT 1 FROM host_audit_log
       WHERE room_id = $1 AND action = 'host_grant_item' AND target_id = $2`,
      [fixtureRoomId, itemId]
    ),
    query(
      `SELECT 1 FROM event_outbox
       WHERE audience_id = $1 AND event_type = 'room.item_granted' AND payload->>'itemId' = $2`,
      [fixtureRoomId, itemId]
    )
  ]);
  assert.equal(inventory.rowCount, 0);
  assert.equal(timeline.rowCount, 0);
  assert.equal(audit.rowCount, 0);
  assert.equal(outbox.rowCount, 0);
});

test("repeated clue and scene host actions do not duplicate timeline or SSE", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleSlotId = await queryFixtureRoleId();
  const clue = await query(
    `INSERT INTO clues (world_id, name) VALUES ($1, $2) RETURNING id`,
    [fixtureWorldId, `dedupe-clue-${Date.now()}`]
  );
  context.after(() => query(`DELETE FROM clues WHERE id = $1`, [clue.rows[0].id]));
  const scene = await query(
    `INSERT INTO scenes (world_id, name) VALUES ($1, $2) RETURNING id`,
    [fixtureWorldId, `dedupe-scene-${Date.now()}`]
  );
  context.after(() => query(`DELETE FROM scenes WHERE id = $1`, [scene.rows[0].id]));

  const grant = (key) => app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/grant-clue`,
    headers: { "x-user-id": hostUserId, "idempotency-key": key },
    payload: { roleSlotId, clueId: clue.rows[0].id }
  });
  const firstGrant = await grant(`grant-clue-a-${Date.now()}`);
  const secondGrant = await grant(`grant-clue-b-${Date.now()}`);
  assert.equal(firstGrant.statusCode, 200, firstGrant.body);
  assert.equal(secondGrant.statusCode, 200, secondGrant.body);
  assert.equal(firstGrant.json().granted, 1);
  assert.equal(secondGrant.json().granted, 0);

  const unlock = (key) => app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/scenes/${scene.rows[0].id}/unlock`,
    headers: { "x-user-id": hostUserId, "idempotency-key": key }
  });
  const firstUnlock = await unlock(`unlock-scene-a-${Date.now()}`);
  const secondUnlock = await unlock(`unlock-scene-b-${Date.now()}`);
  assert.equal(firstUnlock.statusCode, 200, firstUnlock.body);
  assert.equal(secondUnlock.statusCode, 200, secondUnlock.body);

  const [clueTimeline, clueOutbox, sceneTimeline, sceneOutbox] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS count FROM timeline_logs
       WHERE room_id = $1 AND event_type = 'host_grant_clue' AND metadata->>'clueId' = $2`,
      [fixtureRoomId, clue.rows[0].id]
    ),
    query(
      `SELECT COUNT(*)::int AS count FROM event_outbox
       WHERE audience_id = $1 AND event_type = 'room.clue_granted' AND payload->>'clueId' = $2`,
      [fixtureRoomId, clue.rows[0].id]
    ),
    query(
      `SELECT COUNT(*)::int AS count FROM timeline_logs
       WHERE room_id = $1 AND event_type = 'scene_unlocked' AND metadata->>'sceneId' = $2`,
      [fixtureRoomId, scene.rows[0].id]
    ),
    query(
      `SELECT COUNT(*)::int AS count FROM event_outbox
       WHERE audience_id = $1 AND event_type = 'room.scene_unlocked' AND payload->>'sceneId' = $2`,
      [fixtureRoomId, scene.rows[0].id]
    )
  ]);
  assert.equal(clueTimeline.rows[0].count, 1);
  assert.equal(clueOutbox.rows[0].count, 1);
  assert.equal(sceneTimeline.rows[0].count, 1);
  assert.equal(sceneOutbox.rows[0].count, 1);
});
