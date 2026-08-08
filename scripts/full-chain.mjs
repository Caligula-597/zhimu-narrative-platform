#!/usr/bin/env node
/**
 * 织幕本地全链路验证 — 一次跑通 DB 测试、API smoke、UI smoke、Demo Act2。
 *
 * Usage:
 *   node scripts/full-chain.mjs              # 默认（需 DATABASE_URL + 可选 4180/4173）
 *   node scripts/full-chain.mjs --fresh      # 先 bootstrap:local（migrate + seed + exploration）
 *   node scripts/full-chain.mjs --skip-e2e    # 跳过 Playwright 浏览器测试
 *
 * 双浏览器 SSE / 主持确认等需手动在 TEST-FIXTURE-DEMO 房间验证。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const args = new Set(process.argv.slice(2));
const fresh = args.has("--fresh");
const skipTests = args.has("--skip-tests");
const allowOffline = args.has("--allow-offline");

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
}

if (!skipTests) {
  run("secret exposure audit", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "check:secret-exposure"], { cwd: root });
  run("security baseline", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "check:security-baseline"], { cwd: root });
  run("pure security regression", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "test:security:pure"], { cwd: root });
  run("check:schemas", process.execPath, [path.join("scripts", "verify-route-schemas.mjs")], { cwd: backend });
  run("backend npm test", process.platform === "win32" ? "npm.cmd" : "npm", ["test"], { cwd: backend });
  run("innerHTML audit", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "audit:innerhtml"], { cwd: root });
  run("frontend maintenance contracts", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "check:frontend-maintenance"], { cwd: root });
  run("shared tests", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "test:shared"], { cwd: root });
  run("secure random identifier tests", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "test:secure-random"], { cwd: root });
  run("main production build", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], { cwd: root });
  run("format helper tests", process.execPath, ["--test", path.join("scripts", "format-helpers.test.mjs")], { cwd: root });
  run("runtime store tests", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "test:runtime-stores"], { cwd: root });
  run("pipeline session tests", process.execPath, ["--test", path.join("scripts", "pipeline-wizard-session.test.mjs")], { cwd: root });
  run("test:play", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "test:play"], { cwd: root });
  run("test:host", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "test:host"], { cwd: root });
}

const apiUp = await probe("http://localhost:4180/api/health/live");
const uiUp = await probe("http://localhost:4173/");
const playUp = await probe("http://localhost:5174/");

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

const e2eReady = apiUp && uiUp && playUp && !args.has("--skip-e2e");
if (e2eReady) {
  run("Playwright E2E (15)", process.platform === "win32" ? "npx.cmd" : "npx", [
    "playwright",
    "test",
    "--config=playwright.config.js"
  ], {
    cwd: root
  });
} else if (!args.has("--skip-e2e") && (apiUp || uiUp)) {
  console.warn("\nWARN  E2E 需要 4173 + 4180 + 5174（play dev）同时在线 — 跳过 Playwright");
  console.warn("      终端 C: cd play && npm run dev");
}

console.log(`
════════════════════════════════════════════════════════
  自动化段完成（含 Playwright · 副本房 TEST-E2E-REMOVED）。

  演示用手动房间 TEST-FIXTURE-DEMO 不会被 E2E 写入。
  官方公开示例剧本：平台目录「小示例」（非本测试桩）。
  AI 探索同样使用副本房：npm run explore:ai
════════════════════════════════════════════════════════
`);

if ((!apiUp || !uiUp) && !allowOffline) {
  process.exitCode = 1;
}
