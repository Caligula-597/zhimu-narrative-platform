/**
 * Backfill reading → unlock automation rules for an imported matrix pilot world.
 *
 * Usage:
 *   node backend/scripts/seed-pilot-unlock-rules.mjs
 *   node backend/scripts/seed-pilot-unlock-rules.mjs <worldId>
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const backendRoot = join(root, "backend");

for (const file of [join(backendRoot, ".env"), join(root, ".env")]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const argWorldId = process.argv[2];
const importRunPath = join(root, "examples", "pending-review", "停雪公馆", "import-run.json");
const fallbackWorldId = existsSync(importRunPath)
  ? JSON.parse(readFileSync(importRunPath, "utf8")).worldId
  : null;
const worldId = argWorldId || fallbackWorldId;

if (!worldId) {
  console.error("请提供 worldId，或先运行 import-matrix-pilot.mjs 生成 import-run.json");
  process.exit(1);
}

const { pool, transaction } = await import("../src/db.js");
const { materializePipelineReadingUnlockRules } = await import("../src/routes/world-helpers.js");

const world = await pool.query(`SELECT id, name, settings FROM worlds WHERE id = $1`, [worldId]);
if (!world.rowCount) {
  console.error(`世界不存在：${worldId}`);
  process.exit(1);
}

const result = await transaction(async (client) =>
  materializePipelineReadingUnlockRules(client, worldId, {
    matrixMode: world.rows[0].settings?.matrixSync?.matrixMode || "honkaku"
  })
);

const ruleCount = await pool.query(
  `SELECT count(*)::int AS n FROM automation_rules WHERE world_id = $1 AND room_id IS NULL`,
  [worldId]
);

console.log(JSON.stringify({ worldId, worldName: world.rows[0].name, ...result, totalRules: ruleCount.rows[0].n }, null, 2));
await pool.end();
