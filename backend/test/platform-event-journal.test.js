import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchPlatformEventsAfter,
  getLatestPlatformEventId
} from "../src/platform-event-journal.js";
import { query } from "../src/db.js";
import { hostUserId } from "./helpers/fixture-ids.js";

async function insertJournalEvent({ audienceType, userId = null, event }) {
  const result = await query(
    `INSERT INTO platform_event_journal (audience_type, audience_user_id, event_type, payload)
     VALUES ($1, $2, $3, $4::jsonb) RETURNING id, created_at`,
    [audienceType, userId, event.type, JSON.stringify(event)]
  );
  return result.rows[0];
}

test("platform journal replays merged broadcast and user events in order", async (context) => {
  const marker = `journal-${Date.now()}`;
  const broadcast = await insertJournalEvent({
    audienceType: "broadcast",
    event: { type: "plaza.post_created", marker }
  });
  const personal = await insertJournalEvent({
    audienceType: "user",
    userId: hostUserId,
    event: { type: "dm.message_created", marker }
  });
  context.after(async () => {
    await query(`DELETE FROM platform_event_journal WHERE payload->>'marker' = $1`, [marker]);
  });

  const rows = await fetchPlatformEventsAfter(hostUserId, Number(broadcast.id) - 1, {
    throughId: Number(personal.id),
    limit: 10
  });
  assert.deepEqual(rows.map((row) => row.payload.type), ["plaza.post_created", "dm.message_created"]);
  assert.ok(await getLatestPlatformEventId(hostUserId) >= Number(personal.id));
});
