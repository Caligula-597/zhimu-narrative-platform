import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { startRoomEventBus, stopRoomEventBus } from "../src/room-event-bus.js";
import { startPlatformEventBus, stopPlatformEventBus } from "../src/platform-event-bus.js";
import {
  createPostgresEventListener,
  getPostgresEventListenerStatus
} from "../src/postgres-event-listener.js";
import { pool } from "../src/db.js";

test("room and platform buses share one PostgreSQL LISTEN connection", async (context) => {
  if (!process.env.DATABASE_URL) {
    context.skip("DATABASE_URL is required for the integration assertion");
    return;
  }
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

test("a cold-start LISTEN failure keeps its registration and reconnects", async (context) => {
  assert.equal(getPostgresEventListenerStatus().connected, false);
  const originalConnect = pool.connect;
  let attempts = 0;
  const queries = [];

  class FakeClient extends EventEmitter {
    async query(sql) {
      queries.push(sql);
    }

    release() {}
  }

  const fakeClient = new FakeClient();
  pool.connect = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("injected cold-start failure");
    return fakeClient;
  };

  const errors = [];
  const listener = createPostgresEventListener({
    channel: "zhimu_listener_recovery_test",
    onNotification: () => {},
    onError: (error) => errors.push(error.message)
  });

  context.after(async () => {
    await listener.stop();
    pool.connect = originalConnect;
  });

  await assert.rejects(listener.start(), /injected cold-start failure/);
  assert.equal(listener.isListening(), false);

  const deadline = Date.now() + 2500;
  while (!listener.isListening() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  assert.equal(listener.isListening(), true);
  assert.equal(attempts, 2);
  assert.deepEqual(errors, ["injected cold-start failure"]);
  assert.ok(queries.includes("LISTEN zhimu_listener_recovery_test"));
});
