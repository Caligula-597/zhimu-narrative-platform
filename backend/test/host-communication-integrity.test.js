import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureRoomId, hostUserId } from "./helpers/fixture-ids.js";
import { queryFixtureRoleId } from "./helpers/fixture-helpers.js";

async function createForeignRole(context) {
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name)
     VALUES ($1, $2)
     RETURNING id`,
    [hostUserId, `communication-foreign-${Date.now()}`]
  );
  const worldId = world.rows[0].id;
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [worldId]));
  const role = await query(
    `INSERT INTO role_slots (world_id, name, sequence)
     VALUES ($1, 'foreign role', 1)
     RETURNING id`,
    [worldId]
  );
  return role.rows[0].id;
}

test("host manual log is idempotent and commits audit plus SSE outbox atomically", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const marker = `communication-idempotent-${Date.now()}`;
  const key = `host-log-${Date.now()}`;
  const send = () => app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/log`,
    headers: { "x-user-id": hostUserId, "idempotency-key": key },
    payload: { message: marker, eventType: "host_note" }
  });
  const first = await send();
  const second = await send();
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(second.statusCode, 200, second.body);
  assert.equal(second.json().logId, first.json().logId);

  const logs = await query(
    `SELECT id FROM timeline_logs WHERE room_id = $1 AND message = $2`,
    [fixtureRoomId, marker]
  );
  assert.equal(logs.rowCount, 1);
  const audit = await query(
    `SELECT 1 FROM host_audit_log
     WHERE room_id = $1 AND action = 'host_manual_log' AND target_id = $2`,
    [fixtureRoomId, String(logs.rows[0].id)]
  );
  assert.equal(audit.rowCount, 1);
  const outbox = await query(
    `SELECT payload FROM event_outbox
     WHERE event_scope = 'room' AND audience_id = $1
       AND event_type = 'room.host_log_created'
       AND payload->>'logId' = $2`,
    [fixtureRoomId, String(logs.rows[0].id)]
  );
  assert.equal(outbox.rowCount, 1);
});

test("host manual log rejects a role from another world without writing", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const foreignRoleId = await createForeignRole(context);
  const marker = `communication-cross-world-${Date.now()}`;
  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/log`,
    headers: { "x-user-id": hostUserId },
    payload: { message: marker, roleSlotId: foreignRoleId }
  });
  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().code, "ROLE_SLOT_WORLD_MISMATCH");
  const stored = await query(`SELECT 1 FROM timeline_logs WHERE message = $1`, [marker]);
  assert.equal(stored.rowCount, 0);
});

test("host communication rejects UUID-shaped garbage before PostgreSQL", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/log`,
    headers: { "x-user-id": hostUserId },
    payload: {
      message: "must not reach postgres",
      roleSlotId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  });
  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().code, "VALIDATION_ERROR");
});

test("host nudge removes foreign and inactive role targets before SSE delivery", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const activeRoleId = await queryFixtureRoleId();
  const foreignRoleId = await createForeignRole(context);
  const marker = `communication-target-filter-${Date.now()}`;
  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/nudge-waiting`,
    headers: { "x-user-id": hostUserId, "idempotency-key": `host-nudge-${Date.now()}` },
    payload: { message: marker, roleSlotIds: [activeRoleId, foreignRoleId] }
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().roleSlotIds, [activeRoleId]);
  assert.equal(response.json().notifiedCount, 1);

  const outbox = await query(
    `SELECT payload FROM event_outbox
     WHERE event_scope = 'room' AND audience_id = $1
       AND event_type = 'room.host_nudge'
       AND payload->>'message' = $2
     ORDER BY id DESC LIMIT 1`,
    [fixtureRoomId, marker]
  );
  assert.equal(outbox.rowCount, 1);
  assert.deepEqual(outbox.rows[0].payload.roleSlotIds, [activeRoleId]);
});

test("host nudge with only invalid targets does not write or broadcast", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const foreignRoleId = await createForeignRole(context);
  const marker = `communication-empty-target-${Date.now()}`;
  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/nudge-waiting`,
    headers: { "x-user-id": hostUserId },
    payload: { message: marker, roleSlotIds: [foreignRoleId] }
  });
  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().code, "NO_PLAYERS_TO_NUDGE");
  const stored = await query(`SELECT 1 FROM timeline_logs WHERE message = $1`, [marker]);
  assert.equal(stored.rowCount, 0);
});
