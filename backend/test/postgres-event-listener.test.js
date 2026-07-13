import assert from "node:assert/strict";
import test from "node:test";
import { startRoomEventBus, stopRoomEventBus } from "../src/room-event-bus.js";
import { startPlatformEventBus, stopPlatformEventBus } from "../src/platform-event-bus.js";
import { getPostgresEventListenerStatus } from "../src/postgres-event-listener.js";

test("room and platform buses share one PostgreSQL LISTEN connection", async (context) => {
  if (!process.env.DATABASE_URL) return;
  const previous = process.env.ROOM_EVENTS_BUS;
  process.env.ROOM_EVENTS_BUS = "postgres";
  await startRoomEventBus();
  await startPlatformEventBus();
  context.after(async () => {
    await stopRoomEventBus();
    await stopPlatformEventBus();
    if (previous === undefined) delete process.env.ROOM_EVENTS_BUS;
    else process.env.ROOM_EVENTS_BUS = previous;
  });

  assert.deepEqual(getPostgresEventListenerStatus(), {
    connected: true,
    connectionCount: 1,
    channels: ["zhimu_platform_events", "zhimu_room_events"]
  });
});
