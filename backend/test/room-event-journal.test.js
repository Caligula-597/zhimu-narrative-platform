import assert from "node:assert/strict";
import test from "node:test";
import { query } from "../src/db.js";
import { appendRoomEventJournal, fetchJournalEventsAfter } from "../src/room-event-journal.js";

const fogRoomId = "a65f94eb-a987-463c-bb81-aa482367e54a";

test("room event journal supports ordered replay after id", async (context) => {
  const first = await appendRoomEventJournal(fogRoomId, { type: "room.test_event", roomId: fogRoomId, n: 1 });
  const second = await appendRoomEventJournal(fogRoomId, { type: "room.test_event", roomId: fogRoomId, n: 2 });

  const replay = await fetchJournalEventsAfter(fogRoomId, first.id);
  assert.equal(replay.length, 1);
  assert.equal(replay[0].id, second.id);
  assert.equal(replay[0].payload.n, 2);

  context.after(async () => {
    await query(`DELETE FROM room_event_journal WHERE room_id = $1 AND event_type = 'room.test_event'`, [fogRoomId]);
  });
});