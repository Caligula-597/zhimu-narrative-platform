import assert from "node:assert/strict";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import test from "node:test";
import { query } from "../src/db.js";
import { appendRoomEventJournal, fetchJournalEventsAfter } from "../src/room-event-journal.js";



test("room event journal supports ordered replay after id", async (context) => {
  const first = await appendRoomEventJournal(fixtureRoomId, { type: "room.test_event", roomId: fixtureRoomId, n: 1 });
  const second = await appendRoomEventJournal(fixtureRoomId, { type: "room.test_event", roomId: fixtureRoomId, n: 2 });

  const replay = await fetchJournalEventsAfter(fixtureRoomId, first.id);
  assert.equal(replay.length, 1);
  assert.equal(replay[0].id, second.id);
  assert.equal(replay[0].payload.n, 2);

  context.after(async () => {
    await query(`DELETE FROM room_event_journal WHERE room_id = $1 AND event_type = 'room.test_event'`, [fixtureRoomId]);
  });
});

test("room event journal rejects malformed replay cursor without querying invalid ids", async () => {
  assert.deepEqual(await fetchJournalEventsAfter(fixtureRoomId, "not-a-number"), []);
  assert.deepEqual(await fetchJournalEventsAfter(fixtureRoomId, "-1"), []);
  assert.deepEqual(await fetchJournalEventsAfter(fixtureRoomId, "1.5"), []);
});

test("room event journal caps replay limit", async (context) => {
  const marker = `room.test_limit_${Date.now()}`;
  const first = await appendRoomEventJournal(fixtureRoomId, { type: marker, roomId: fixtureRoomId, n: 1 });
  await appendRoomEventJournal(fixtureRoomId, { type: marker, roomId: fixtureRoomId, n: 2 });

  const replay = await fetchJournalEventsAfter(fixtureRoomId, first.id - 1, 1);
  assert.equal(replay.length, 1);

  context.after(async () => {
    await query(`DELETE FROM room_event_journal WHERE room_id = $1 AND event_type = $2`, [fixtureRoomId, marker]);
  });
});
