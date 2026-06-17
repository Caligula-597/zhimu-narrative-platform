import assert from "node:assert/strict";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";


async function playerRoleId() {
  const result = await query(
    `SELECT role_slot_id FROM room_members WHERE room_id = $1 AND user_id = $2 AND status = 'active'`,
    [fixtureRoomId, playerUserId]
  );
  return result.rows[0].role_slot_id;
}

async function firstReadableSection(roleId) {
  const result = await query(
    `SELECT id FROM script_sections WHERE role_slot_id = $1 ORDER BY sequence LIMIT 1`,
    [roleId]
  );
  return result.rows[0].id;
}

test("checkpoint restore reverts reading progress to snapshot state", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const roleId = await playerRoleId();
  const sectionId = await firstReadableSection(roleId);

  await query(
    `DELETE FROM reading_progress WHERE room_id = $1 AND role_slot_id = $2 AND script_section_id = $3`,
    [fixtureRoomId, roleId, sectionId]
  );

  const baseline = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/checkpoints`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "restore-baseline", description: "before reading change" }
  });
  assert.equal(baseline.statusCode, 201);
  const checkpointId = baseline.json().id;

  const complete = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/sections/${sectionId}/complete`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(complete.statusCode, 200);

  const progressBeforeRestore = await query(
    `SELECT completed_at FROM reading_progress
     WHERE room_id = $1 AND role_slot_id = $2 AND script_section_id = $3`,
    [fixtureRoomId, roleId, sectionId]
  );
  assert.ok(progressBeforeRestore.rowCount);

  const restore = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/checkpoints/${checkpointId}/restore`,
    headers: { "x-user-id": hostUserId },
    payload: { scope: { readingProgress: true, clueOwnership: false, inventory: false, contentUnlocks: false, pendingHostEvents: false } }
  });
  assert.equal(restore.statusCode, 200);
  assert.equal(restore.json().status, "applied");

  const progressAfterRestore = await query(
    `SELECT completed_at FROM reading_progress
     WHERE room_id = $1 AND role_slot_id = $2 AND script_section_id = $3`,
    [fixtureRoomId, roleId, sectionId]
  );
  assert.equal(progressAfterRestore.rowCount, 0, "reading progress should be cleared by scoped restore");

  const audit = await query(
    `SELECT 1 FROM host_audit_log WHERE room_id = $1 AND action = 'checkpoint_restore'`,
    [fixtureRoomId]
  );
  assert.ok(audit.rowCount >= 1, "checkpoint_restore should be audited");
});

test("idempotency key returns same complete-section response", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const roleId = await playerRoleId();
  const sectionId = await firstReadableSection(roleId);
  const key = `test-complete-${Date.now()}`;

  const first = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/sections/${sectionId}/complete`,
    headers: { "x-user-id": playerUserId, "idempotency-key": key }
  });
  assert.equal(first.statusCode, 200);

  const second = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/sections/${sectionId}/complete`,
    headers: { "x-user-id": playerUserId, "idempotency-key": key }
  });
  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.json(), first.json());
});

test("checkpoint restore is idempotent with Idempotency-Key", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const create = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/checkpoints`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "idempotent-restore", description: "probe" }
  });
  assert.equal(create.statusCode, 201);
  const checkpointId = create.json().id;
  const key = `restore-${Date.now()}`;

  const first = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/checkpoints/${checkpointId}/restore`,
    headers: { "x-user-id": hostUserId, "idempotency-key": key },
    payload: { scope: { readingProgress: false, clueOwnership: false, inventory: false, contentUnlocks: false, pendingHostEvents: false, investigationRecords: false } }
  });
  assert.equal(first.statusCode, 200);

  const second = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/checkpoints/${checkpointId}/restore`,
    headers: { "x-user-id": hostUserId, "idempotency-key": key },
    payload: { scope: { readingProgress: false, clueOwnership: false, inventory: false, contentUnlocks: false, pendingHostEvents: false, investigationRecords: false } }
  });
  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.json(), first.json());
});