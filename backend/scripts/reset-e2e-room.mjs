#!/usr/bin/env node
/**
 * Reset E2E parallel room runtime state. Does NOT modify FOG-HARBOR-DEMO demo room.
 */
import { pool } from "../src/db.js";
import { E2E } from "./e2e-room/constants.mjs";
import { provisionE2eRoom } from "./e2e-room/provision.mjs";
import { resetE2eRoomRuntime } from "./e2e-room/reset.mjs";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await provisionE2eRoom(client);
  const meta = await resetE2eRoomRuntime(client);
  await client.query("COMMIT");
  console.log(JSON.stringify({ ok: true, ...E2E, ...meta, demoRoomUntouched: true }, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  console.error(error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
