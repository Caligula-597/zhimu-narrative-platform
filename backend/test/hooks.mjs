/**
 * Global test hooks — env defaults + PG pool teardown.
 * Loaded via `node --import ./test/hooks.mjs` so it runs before any test file.
 */
import { after } from "node:test";
import { pool } from "../src/db.js";
import { waitForScheduledEventOutbox } from "../src/event-outbox-dispatcher.js";
import { stopRoomEventBus } from "../src/room-event-bus.js";
import { stopPlatformEventBus } from "../src/platform-event-bus.js";
import { hostUserId } from "./helpers/fixture-ids.js";

/** Hundreds of tests register from 127.0.0.1; disable IP caps unless a test overrides. */
process.env.REGISTER_IP_DAY_MAX ??= "0";
process.env.GUEST_CREATE_HOUR_MAX ??= "1000";
process.env.GUEST_CREATE_DAY_MAX ??= "1000";
process.env.PLAY_SOCIAL_ACCOUNT_COOLDOWN_MIN ??= "0";
process.env.OBJECT_STORAGE_PROVIDER ??= "memory";

await pool.query(
  `INSERT INTO storage_quotas (user_id, max_worlds, max_bytes, max_single_file_bytes)
   VALUES ($1, 10000, 53687091200, 1073741824)
   ON CONFLICT (user_id) DO UPDATE
     SET max_worlds = GREATEST(storage_quotas.max_worlds, EXCLUDED.max_worlds),
         max_bytes = GREATEST(storage_quotas.max_bytes, EXCLUDED.max_bytes),
         max_single_file_bytes = GREATEST(storage_quotas.max_single_file_bytes, EXCLUDED.max_single_file_bytes)`,
  [hostUserId]
);

after(async () => {
  await waitForScheduledEventOutbox().catch(() => {});
  await stopRoomEventBus().catch(() => {});
  await stopPlatformEventBus().catch(() => {});
  await pool.end().catch(() => {});
});
