/**
 * Global test teardown — release PG pool so node --test can exit cleanly.
 */
import { after } from "node:test";
import { pool } from "../src/db.js";
import { stopRoomEventBus } from "../src/room-event-bus.js";

after(async () => {
  await stopRoomEventBus().catch(() => {});
  await pool.end().catch(() => {});
});
