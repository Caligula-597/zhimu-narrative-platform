import assert from "node:assert/strict";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import { queryFixtureRoleId } from "./helpers/fixture-helpers.js";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";

test("host players list returns runtime table rows for hosts", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/host/players`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.ok(Array.isArray(payload.players));
  assert.ok(payload.players.length >= 1);
  assert.ok(Object.hasOwn(payload.players[0], "completed_sections"));
  assert.ok(Object.hasOwn(payload.players[0], "clue_count"));
  assert.equal(typeof payload.stuckCount, "number");
});

test("host can grant clue and unlock section manually", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleSlotId = await queryFixtureRoleId();
  const clue = await query(
    `SELECT c.id FROM clues c
     JOIN rooms r ON r.world_id = c.world_id
     WHERE r.id = $1
     LIMIT 1`,
    [fixtureRoomId]
  );
  const section = await query(
    `SELECT id FROM script_sections WHERE role_slot_id = $1 ORDER BY sequence DESC LIMIT 1`,
    [roleSlotId]
  );
  assert.ok(clue.rowCount, "clue fixture required");
  assert.ok(section.rowCount, "section fixture required");

  const grant = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/grant-clue`,
    headers: { "x-user-id": hostUserId },
    payload: { roleSlotId, clueId: clue.rows[0].id, message: "测试发放" }
  });
  assert.equal(grant.statusCode, 200);
  assert.equal(grant.json().ok, true);

  const unlock = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/unlock-section`,
    headers: { "x-user-id": hostUserId },
    payload: { roleSlotId, scriptSectionId: section.rows[0].id, message: "测试解锁" }
  });
  assert.equal(unlock.statusCode, 200);
  assert.equal(unlock.json().ok, true);

  const detail = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/host/players/${roleSlotId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(detail.statusCode, 200);
  const payload = detail.json();
  assert.ok(payload.clues.some((item) => item.id === clue.rows[0].id));
  assert.ok(payload.sections.some((item) => item.id === section.rows[0].id && item.unlocked));
});

test("host events include action summaries and can be dismissed", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const events = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/host-events`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(events.statusCode, 200);
  const list = events.json();
  if (list.length) {
    assert.ok(Array.isArray(list[0].action_summaries));
    const dismiss = await app.inject({
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/host-events/${list[0].id}/dismiss`,
      headers: { "x-user-id": hostUserId }
    });
    assert.equal(dismiss.statusCode, 200);
    assert.equal(dismiss.json().ok, true);
  }
});

test("host events batch execute and dismiss", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const inserted = await query(
    `INSERT INTO pending_host_events (room_id, event_key, title, description, actions, status)
     VALUES ($1, $2, '批量测试 A', '', '[]'::jsonb, 'pending'),
            ($1, $3, '批量测试 B', '', '[]'::jsonb, 'pending')
     RETURNING id`,
    [fixtureRoomId, `batch-a-${Date.now()}`, `batch-b-${Date.now()}`]
  );
  const ids = inserted.rows.map((row) => row.id);

  const dismiss = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host-events/batch`,
    headers: { "x-user-id": hostUserId, "idempotency-key": `batch-dismiss-${Date.now()}` },
    payload: { action: "dismiss", eventIds: ids }
  });
  assert.equal(dismiss.statusCode, 200);
  assert.equal(dismiss.json().processed, 2);

  const remaining = await query(
    `SELECT status FROM pending_host_events WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  assert.ok(remaining.rows.every((row) => row.status === "dismissed"));
});

test("host audit log lists recent host actions", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const roleSlotId = await queryFixtureRoleId();
  const clue = await query(
    `SELECT c.id FROM clues c
     JOIN rooms r ON r.world_id = c.world_id
     WHERE r.id = $1
     LIMIT 1`,
    [fixtureRoomId]
  );
  assert.ok(clue.rowCount);

  const grant = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/grant-clue`,
    headers: { "x-user-id": hostUserId, "idempotency-key": `audit-probe-${Date.now()}` },
    payload: { roleSlotId, clueId: clue.rows[0].id }
  });
  assert.equal(grant.statusCode, 200);

  const audit = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/host/audit-log?limit=10`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(audit.statusCode, 200);
  const entries = audit.json().entries;
  assert.ok(Array.isArray(entries));
  assert.ok(entries.some((row) => row.action === "host_grant_clue"));
});
