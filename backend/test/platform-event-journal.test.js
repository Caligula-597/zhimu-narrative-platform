import assert from "node:assert/strict";
import test from "node:test";
import {
  appendPlatformEventJournal,
  fetchPlatformEventsAfter,
  getLatestPlatformEventId
} from "../src/platform-event-journal.js";
import { query } from "../src/db.js";
import { hostUserId } from "./helpers/fixture-ids.js";

test("platform journal replays merged broadcast and user events in order", async (context) => {
  const marker = `journal-${Date.now()}`;
  const broadcast = await appendPlatformEventJournal({
    audienceType: "broadcast",
    event: { type: "plaza.post_created", marker }
  });
  const personal = await appendPlatformEventJournal({
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
