#!/usr/bin/env node
/** Create / update E2E parallel room (FOG-E2E-AUTO). Safe to run repeatedly. */
import { pool } from "../src/db.js";
import { E2E } from "./e2e-room/constants.mjs";
import { provisionE2eRoom } from "./e2e-room/provision.mjs";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  const meta = await provisionE2eRoom(client);
  await client.query("COMMIT");
  console.log(JSON.stringify({ ok: true, ...E2E, ...meta }, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  console.error(error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
