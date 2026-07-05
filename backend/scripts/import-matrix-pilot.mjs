/**
 * B0-01 pilot import — render → score → import → readiness → test room.
 *
 * Usage:
 *   node backend/scripts/import-matrix-pilot.mjs 停雪公馆
 *   node backend/scripts/import-matrix-pilot.mjs 停雪公馆 --no-render --no-score
 *   node backend/scripts/import-matrix-pilot.mjs 停雪公馆 --fresh-db
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const backendRoot = join(root, "backend");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const slug = args[0] || "停雪公馆";
const pilotDir = join(root, "examples", "pending-review", slug);
const noRender = process.argv.includes("--no-render");
const noScore = process.argv.includes("--no-score");
const freshDb = process.argv.includes("--fresh-db");

for (const file of [join(backendRoot, ".env"), join(root, ".env")]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const { pool } = await import("../src/db.js");
const { importDeepseekPipelinePackage } = await import("../src/routes/world-helpers.js");
const { loadWorldPublishReadiness } = await import("../src/world-readiness-service.js");
const { FIXTURE } = await import("./fixture-constants.mjs");

function runStep(label, script, scriptArgs = []) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(process.execPath, [script, ...scriptArgs], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: false
  });
  if (result.status !== 0) {
    console.error(`FAIL ${label}`);
    process.exit(result.status ?? 1);
  }
}

function inviteCodeFromSlug(name) {
  const base = String(name)
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, "-")
    .slice(0, 10)
    .toUpperCase()
    .replace(/^-+|-+$/g, "") || "PILOT";
  const suffix = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${base}-${suffix}`.slice(0, 32);
}

async function main() {
  const packagePath = join(pilotDir, "import-package.json");
  if (!existsSync(pilotDir)) {
    console.error(`找不到示例目录：${pilotDir}`);
    process.exit(1);
  }

  if (freshDb) {
    runStep("bootstrap:local", join(backendRoot, "scripts", "bootstrap-local.js"));
  }

  if (!noRender) {
    runStep("render review + import-package", join(backendRoot, "scripts", "render-matrix-pilot-review.mjs"), [slug]);
  }

  if (!noScore) {
    runStep("score (mechanical + optional LLM)", join(backendRoot, "scripts", "score-matrix-pilot-example.mjs"), [
      slug,
      "--no-llm"
    ]);
  }

  if (!existsSync(packagePath)) {
    console.error(`缺少 ${packagePath}，请先 render 或 generate`);
    process.exit(1);
  }

  const pipeline = JSON.parse(readFileSync(packagePath, "utf8"));
  const title = pipeline.synopsis?.title || pipeline.proposal?.title || slug;
  const worldId = randomUUID();
  const inviteCode = inviteCodeFromSlug(title);

  console.log(`\n▶ import pipeline → new world`);
  console.log(`  slug=${slug} worldId=${worldId} title=${title}`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO worlds (id, owner_user_id, name, summary, status)
       VALUES ($1, $2, $3, $4, 'testing')`,
      [worldId, FIXTURE.hostUserId, title, pipeline.synopsis?.summary?.slice(0, 500) || ""]
    );
    await client.query(
      `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [worldId, FIXTURE.hostUserId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const importResult = await importDeepseekPipelinePackage(worldId, pipeline);
  console.log("  import summary:", importResult);

  const chapters = await pool.query(
    `SELECT id, title, sequence, metadata FROM chapters WHERE world_id = $1 ORDER BY sequence`,
    [worldId]
  );
  const sections = await pool.query(
    `SELECT count(*)::int AS n FROM script_sections ss
     JOIN role_slots rs ON rs.id = ss.role_slot_id WHERE rs.world_id = $1`,
    [worldId]
  );
  const roles = await pool.query(`SELECT id, name, sequence FROM role_slots WHERE world_id = $1 ORDER BY sequence`, [
    worldId
  ]);
  const clues = await pool.query(`SELECT count(*)::int AS n FROM clues WHERE world_id = $1`, [worldId]);
  const scenes = await pool.query(`SELECT count(*)::int AS n FROM scenes WHERE world_id = $1`, [worldId]);
  const worldSettings = await pool.query(`SELECT settings FROM worlds WHERE id = $1`, [worldId]);

  const envChapters = chapters.rows.filter((row) => String(row.metadata?.publicEnvironment || "").trim());
  console.log(`\n▶ post-import checks`);
  console.log(`  roles=${roles.rowCount} sections=${sections.rows[0].n} chapters=${chapters.rowCount} clues=${clues.rows[0].n} scenes=${scenes.rows[0].n}`);
  console.log(`  chapters with publicEnvironment=${envChapters.length}/${chapters.rowCount}`);
  console.log(`  matrixSync stored=${Boolean(worldSettings.rows[0]?.settings?.matrixSync)}`);

  if (importResult.unlockRulesCreated != null) {
    console.log(`  unlock rules created=${importResult.unlockRulesCreated} mode=${importResult.unlockRuleMode || "—"}`);
  }

  if (envChapters.length < chapters.rowCount) {
    console.warn("  WARN 部分章节缺少 metadata.publicEnvironment");
  }

  const roomName = `${title} · 首场测试`;
  const roomInsert = await pool.query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, $3, $4, 'testing') RETURNING id, invite_code`,
    [worldId, FIXTURE.hostUserId, roomName, inviteCode]
  );
  const roomId = roomInsert.rows[0].id;
  await pool.query(`INSERT INTO room_members (room_id, user_id, member_type) VALUES ($1, $2, 'host')`, [
    roomId,
    FIXTURE.hostUserId
  ]);
  await pool.query(
    `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id) VALUES ($1, '公共讨论房', 'public', $2)`,
    [roomId, FIXTURE.hostUserId]
  );

  const readiness = await loadWorldPublishReadiness(worldId);
  const errors = readiness.checks.filter((c) => c.level === "error");
  const warnings = readiness.checks.filter((c) => c.level === "warning");
  console.log(`  publish-readiness: ${errors.length} errors, ${warnings.length} warnings, score=${readiness.score ?? "—"}`);
  for (const check of [...errors, ...warnings].slice(0, 8)) {
    console.log(`    [${check.level}] ${check.title} — ${check.detail}`);
  }

  const summary = {
    slug,
    worldId,
    roomId,
    inviteCode: roomInsert.rows[0].invite_code,
    title,
    import: importResult,
    counts: {
      roles: roles.rowCount,
      sections: sections.rows[0].n,
      chapters: chapters.rowCount,
      clues: clues.rows[0].n,
      scenes: scenes.rows[0].n,
      publicEnvironmentChapters: envChapters.length
    },
    readiness: {
      score: readiness.score,
      errors: errors.length,
      warnings: warnings.length
    },
    playUrl: `http://localhost:5174/?join=${roomInsert.rows[0].invite_code}`,
    hostUrl: `http://localhost:5175/?room=${roomId}`
  };

  console.log("\n════════════════════════════════════════");
  console.log("  B0-01 停雪导入完成");
  console.log(`  世界 ID   ${worldId}`);
  console.log(`  房间 ID   ${roomId}`);
  console.log(`  邀请码    ${roomInsert.rows[0].invite_code}`);
  console.log(`  玩家链接  ${summary.playUrl}`);
  console.log(`  主持链接  ${summary.hostUrl}`);
  console.log(`  就绪      ${errors.length === 0 ? "✓ 可开首场" : "△ 有阻塞项，见上方 checks"}`);
  console.log("════════════════════════════════════════\n");

  await pool.end();
  return summary;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
