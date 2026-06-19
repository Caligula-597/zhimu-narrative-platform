/**
 * Global test hooks — env defaults + PG pool teardown.
 * Loaded via `node --import ./test/hooks.mjs` so it runs before any test file.
 */
import { after } from "node:test";
import { pool } from "../src/db.js";
import { stopRoomEventBus } from "../src/room-event-bus.js";

/** Hundreds of tests register from 127.0.0.1; disable IP caps unless a test overrides. */
process.env.REGISTER_IP_DAY_MAX ??= "0";
process.env.GUEST_CREATE_HOUR_MAX ??= "1000";
process.env.GUEST_CREATE_DAY_MAX ??= "1000";
process.env.PLAY_SOCIAL_ACCOUNT_COOLDOWN_MIN ??= "0";
process.env.OFFICIAL_EXAMPLE_WORLD_ID ??= "33333333-3333-4333-8444-555555550003";

after(async () => {
  await stopRoomEventBus().catch(() => {});
  await pool.end().catch(() => {});
});
