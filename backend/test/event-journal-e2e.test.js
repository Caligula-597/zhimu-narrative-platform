import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { transactionWithEvents } from "../src/transaction-events.js";
import { resetRoomEventBusForTests } from "../src/room-event-bus.js";
import { fixtureRoomId, playerUserId } from "./helpers/fixture-ids.js";

async function maxJournalId(roomId) {
  const result = await query(
    `SELECT COALESCE(MAX(id), 0) AS max_id FROM room_event_journal WHERE room_id = $1`,
    [roomId]
  );
  return Number(result.rows[0].max_id);
}

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

test("complete section appends room.section_completed to journal after commit", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const roleId = await playerRoleId();
  const sectionId = await firstReadableSection(roleId);
  const beforeId = await maxJournalId(fixtureRoomId);

  await query(
    `DELETE FROM reading_progress WHERE room_id = $1 AND role_slot_id = $2 AND script_section_id = $3`,
    [fixtureRoomId, roleId, sectionId]
  );

  const complete = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/sections/${sectionId}/complete`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(complete.statusCode, 200);

  const journal = await query(
    `SELECT event_type, payload FROM room_event_journal
     WHERE room_id = $1 AND id > $2 AND event_type = 'room.section_completed'
     ORDER BY id DESC LIMIT 1`,
    [fixtureRoomId, beforeId]
  );
  assert.ok(journal.rowCount >= 1, "journal should contain room.section_completed after API commit");
  assert.equal(journal.rows[0].payload.sectionId, sectionId);
});

test("transactionWithEvents appends journal only after successful commit", async () => {
  resetRoomEventBusForTests();
  const beforeId = await maxJournalId(fixtureRoomId);

  await transactionWithEvents(async (client, queueEvent) => {
    queueEvent(fixtureRoomId, "room.test_journal_commit", { probe: "commit" });
    await client.query("SELECT 1");
  });

  let committed = { rowCount: 0 };
  for (let attempt = 0; attempt < 20 && committed.rowCount === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    committed = await query(
      `SELECT 1 FROM room_event_journal
       WHERE room_id = $1 AND id > $2 AND event_type = 'room.test_journal_commit'`,
      [fixtureRoomId, beforeId]
    );
  }
  assert.ok(committed.rowCount >= 1);
});

test("transactionWithEvents does not append journal when transaction rolls back", async () => {
  resetRoomEventBusForTests();
  const beforeId = await maxJournalId(fixtureRoomId);

  await assert.rejects(
    () =>
      transactionWithEvents(async (client, queueEvent) => {
        queueEvent(fixtureRoomId, "room.test_journal_rollback", { probe: "rollback" });
        await client.query("SELECT 1");
        throw new Error("journal rollback probe");
      }),
    /journal rollback probe/
  );

  const rolledBack = await query(
    `SELECT 1 FROM room_event_journal
     WHERE room_id = $1 AND id > $2 AND event_type = 'room.test_journal_rollback'`,
    [fixtureRoomId, beforeId]
  );
  assert.equal(rolledBack.rowCount, 0);
});
