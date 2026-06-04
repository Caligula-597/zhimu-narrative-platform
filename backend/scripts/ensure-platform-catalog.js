/**
 * Idempotent: platform demo world in catalog with full seed content.
 * Runs seed scripts when the fixture world is missing or has no roles.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "../src/db.js";

const PLATFORM_WORLD_ID = "08646748-e4ae-446a-a5e7-ce59ca23ffc3";
const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: backendRoot, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited with ${result.status ?? "signal"}`);
  }
}

async function roleCount(client, worldId) {
  const r = await client.query(`SELECT COUNT(*)::int AS n FROM role_slots WHERE world_id = $1`, [worldId]);
  return r.rows[0].n;
}

const client = await pool.connect();
try {
  let exists = await client.query(`SELECT id, name FROM worlds WHERE id = $1`, [PLATFORM_WORLD_ID]);
  let roles = exists.rowCount ? await roleCount(client, PLATFORM_WORLD_ID) : 0;

  if (!exists.rowCount || roles === 0) {
    console.warn(
      `[ensure-platform-catalog] 雾港来信 ${exists.rowCount ? "无角色数据" : "未入库"}，执行 seed…`
    );
    run("node", ["scripts/seed.js"]);
    run("node", ["scripts/seed-exploration.js"]);
    exists = await client.query(`SELECT id, name FROM worlds WHERE id = $1`, [PLATFORM_WORLD_ID]);
    roles = exists.rowCount ? await roleCount(client, PLATFORM_WORLD_ID) : 0;
    if (!exists.rowCount || roles === 0) {
      throw new Error("[ensure-platform-catalog] seed 后仍无雾港角色数据，请检查 DATABASE_URL");
    }
  }

  await client.query(
    `UPDATE worlds SET catalog_public = true, updated_at = now() WHERE id = $1`,
    [PLATFORM_WORLD_ID]
  );
  const sections = await client.query(
    `SELECT COUNT(*)::int AS n FROM script_sections ss
     JOIN role_slots rs ON rs.id = ss.role_slot_id WHERE rs.world_id = $1`,
    [PLATFORM_WORLD_ID]
  );
  console.log(
    `[ensure-platform-catalog] ${exists.rows[0].name} · catalog_public=true · ${roles} 角色 · ${sections.rows[0].n} 分幕`
  );
} finally {
  client.release();
  await pool.end();
}
