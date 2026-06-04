#!/usr/bin/env node
/**
 * 织幕本地全链路验证 — 一次跑通 DB 测试、API smoke、UI smoke、Demo Act2。
 *
 * Usage:
 *   node scripts/full-chain.mjs              # 默认（需 DATABASE_URL + 可选 4180/4173）
 *   node scripts/full-chain.mjs --fresh      # 先 bootstrap:local（migrate + seed + exploration）
 *   node scripts/full-chain.mjs --skip-e2e    # 跳过 Playwright 浏览器测试
 *
 * 双浏览器 SSE / 主持确认等见 DEMO_ROUTE.md 手动段。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const args = new Set(process.argv.slice(2));
const fresh = args.has("--fresh");
const skipTests = args.has("--skip-tests");

function run(label, command, commandArgs, { cwd = root, optional = false } = {}) {
  console.log(`\n>> ${label}`);
  const result = spawnSync(command, commandArgs, { cwd, stdio: "inherit", env: process.env, shell: process.platform === "win32" });
  if (result.status !== 0) {
    if (optional) {
      console.warn(`WARN  ${label} skipped or failed (optional)`);
      return false;
    }
    console.error(`FAIL  ${label}`);
    process.exit(result.status ?? 1);
  }
  return true;
}

async function probe(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return response.ok;
  } catch {
    return false;
  }
}

console.log("织幕 full-chain — 本地全链路验证\n");

if (fresh) {
  run("bootstrap:local", process.execPath, [path.join("scripts", "bootstrap-local.js")], { cwd: backend });
  run("bootstrap e2e room", process.execPath, [path.join("scripts", "bootstrap-e2e-room.mjs")], { cwd: backend, optional: true });
}

if (!skipTests) {
  run("check:schemas", process.execPath, [path.join("scripts", "verify-route-schemas.mjs")], { cwd: backend });
  run("backend npm test", process.platform === "win32" ? "npm.cmd" : "npm", ["test"], { cwd: backend });
  run("format helper tests", process.execPath, ["--test", path.join("scripts", "format-helpers.test.mjs")], { cwd: root });
  run("demo Act2 reading", process.execPath, ["--test", "test/demo-act2-reading.test.js"], { cwd: backend });
}

const apiUp = await probe("http://localhost:4180/api/health/live");
const uiUp = await probe("http://localhost:4173/");

if (apiUp) {
  run("API smoke (18)", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "test:smoke"], { cwd: backend });
} else {
  console.warn("\nWARN  backend :4180 未响应 — 跳过 API smoke");
  console.warn("      终端 A: cd backend && npm run dev");
}

if (uiUp) {
  run("UI smoke", process.execPath, [path.join("scripts", "ui-smoke.js")], { cwd: root });
} else {
  console.warn("\nWARN  frontend :4173 未响应 — 跳过 UI smoke");
  console.warn("      终端 B: npm run dev");
}

const e2eReady = apiUp && uiUp && !args.has("--skip-e2e");
if (e2eReady) {
  run("Playwright E2E (DEMO_ROUTE)", process.platform === "win32" ? "npx.cmd" : "npx", [
    "playwright",
    "test",
    "--config=playwright.config.js"
  ], {
    cwd: root,
    optional: true
  });
} else if (!args.has("--skip-e2e") && (apiUp || uiUp)) {
  console.warn("\nWARN  E2E 需要前后端同时在线 — 跳过 Playwright");
}

console.log(`
════════════════════════════════════════════════════════
  自动化段完成（含 Playwright · 副本房 FOG-E2E-AUTO）。

  演示用手动房间 FOG-HARBOR-DEMO 不会被 E2E 写入。
  AI 探索同样使用副本房：npm run explore:ai

  完整演示脚本：DEMO_ROUTE.md
════════════════════════════════════════════════════════
`);

if (!apiUp || !uiUp) {
  process.exitCode = 1;
}
