import assert from "node:assert/strict";
import test from "node:test";
import {
  resetPlatformEventBusForTests,
  startPlatformEventBus,
  stopPlatformEventBus,
  subscribePlatformUserEvents
} from "../src/platform-event-bus.js";
import { query } from "../src/db.js";
import { hostUserId } from "./helpers/fixture-ids.js";

test("postgres platform bus receives per-user events from another instance", async (context) => {
  if (!process.env.DATABASE_URL) return;
  const previous = process.env.ROOM_EVENTS_BUS;
  process.env.ROOM_EVENTS_BUS = "postgres";
  await startPlatformEventBus();
  context.after(async () => {
    await stopPlatformEventBus();
    resetPlatformEventBusForTests();
    if (previous === undefined) delete process.env.ROOM_EVENTS_BUS;
    else process.env.ROOM_EVENTS_BUS = previous;
  });
  const received = [];
  subscribePlatformUserEvents(hostUserId, (message) => received.push(JSON.parse(message.payload)));
  await query(`SELECT pg_notify($1, $2)`, ["zhimu_platform_events", JSON.stringify({
    sourceInstanceId: "another-instance",
    audienceType: "user",
    userId: hostUserId,
    id: 992,
    payload: JSON.stringify({ type: "dm.message_created", conversationId: "probe" })
  })]);
  const deadline = Date.now() + 2000;
  while (!received.length && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(received[0]?.type, "dm.message_created");
});
