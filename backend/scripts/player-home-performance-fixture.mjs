#!/usr/bin/env node
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { pool } from "../src/db.js";
import { FIXTURE } from "./fixture-constants.mjs";
import { assertSafeDatabaseUrlForTestWrites } from "./lib/assert-safe-database-url.mjs";

const cleanup = process.argv.includes("--cleanup");
const outArg = process.argv.find((value) => value.startsWith("--out="));
const out = outArg?.slice("--out=".length) || "";
const EMAIL_PATTERN = "perf-player-%@zhimu.local";

assertSafeDatabaseUrlForTestWrites(process.env.DATABASE_URL, {
  opName: "player-home performance fixture"
});

async function cleanupUsers(client) {
  const result = await client.query(`DELETE FROM users WHERE email LIKE $1 RETURNING id`, [EMAIL_PATTERN]);
  return result.rowCount;
}

async function hasUsersTable(client) {
  const result = await client.query(`SELECT to_regclass('public.users') IS NOT NULL AS present`);
  return Boolean(result.rows[0]?.present);
}

const client = await pool.connect();
try {
  await client.query("BEGIN");
  if (cleanup && !(await hasUsersTable(client))) {
    await client.query("COMMIT");
    console.log(JSON.stringify({ ok: true, removed: 0, skipped: "users table is not present" }, null, 2));
  } else {
    const removed = await cleanupUsers(client);
    if (cleanup) {
      await client.query("COMMIT");
      console.log(JSON.stringify({ ok: true, removed }, null, 2));
    } else {
      const roles = await client.query(
        `SELECT rs.id, rs.sequence
         FROM role_slots rs
         WHERE rs.world_id = $1
         ORDER BY rs.sequence`,
        [FIXTURE.worldId]
      );
      const existing = await client.query(
        `SELECT rm.user_id, rm.role_slot_id
         FROM room_members rm
         WHERE rm.room_id = $1 AND rm.member_type = 'player'
           AND rm.status = 'active' AND rm.role_slot_id IS NOT NULL`,
        [FIXTURE.roomId]
      );
      const occupied = new Set(existing.rows.map((row) => row.role_slot_id));
      const userIds = existing.rows.map((row) => row.user_id);
      for (const role of roles.rows) {
        if (occupied.has(role.id)) continue;
        const userId = crypto.randomUUID();
        const email = `perf-player-${userId}@zhimu.local`;
        await client.query(
          `INSERT INTO users (id, email, display_name, user_kind, email_verified_at)
           VALUES ($1, $2, $3, 'registered', now())`,
          [userId, email, `性能玩家 ${role.sequence}`]
        );
        await client.query(
          `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id, status)
           VALUES ($1, $2, 'player', $3, 'active')`,
          [FIXTURE.roomId, userId, role.id]
        );
        userIds.push(userId);
      }
      await client.query("COMMIT");
      const result = { ok: true, roomId: FIXTURE.roomId, uniqueUsers: userIds.length, userIds };
      if (out) await fs.writeFile(out, `${JSON.stringify(result, null, 2)}\n`);
      if (process.env.GITHUB_ENV) {
        await fs.appendFile(process.env.GITHUB_ENV, `PLAYER_HOME_USER_IDS=${userIds.join(",")}\n`);
      }
      console.log(JSON.stringify(result, null, 2));
    }
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
