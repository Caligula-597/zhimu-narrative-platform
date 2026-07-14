#!/usr/bin/env node
/**
 * Static robustness checks (no running server):
 * 1) syntax — node --check on every backend JS module
 * 2) import paths — sibling files under src/ must not use ../
 * 3) module graph — dynamic import from app entry (needs DATABASE_URL stub for pool)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(here, "..");
const srcRoot = path.join(backendRoot, "src");
const sharedRoot = path.resolve(backendRoot, "../shared");

async function collectJsFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectJsFiles(full)));
    else if (entry.name.endsWith(".js")) files.push(full);
  }
  return files;
}

function checkImportPaths(filePath, source) {
  const rel = path.relative(srcRoot, filePath);
  if (rel.startsWith("..")) return [];
  const depth = rel.split(path.sep).length - 1;
  const issues = [];
  const importRe = /\bfrom\s+["'](\.[^"']+)["']/g;
  let match;
  while ((match = importRe.exec(source))) {
    const spec = match[1];
    if (!spec.startsWith("../")) continue;
    const resolved = path.resolve(path.dirname(filePath), spec);
    const sharedRelative = path.relative(sharedRoot, resolved);
    if (sharedRelative && !sharedRelative.startsWith("..") && !path.isAbsolute(sharedRelative)) {
      continue;
    }
    const upCount = (spec.match(/\.\.\//g) ?? []).length;
    if (depth === 0 && upCount >= 1) {
      issues.push(`Suspicious import "${spec}" in src/${rel} — use ./ for siblings under src/`);
    }
    if (depth === 1 && upCount >= 2) {
      issues.push(`Suspicious import "${spec}" in src/${rel} — use ../ for src/ modules`);
    }
  }
  return issues;
}

function checkEventOutboxBoundary(filePath, source) {
  const rel = path.relative(srcRoot, filePath).replaceAll("\\", "/");
  const issues = [];
  for (const symbol of [
    "publishRoomEvent",
    "publishQueuedEvents",
    "publishPlatformUserEvent",
    "publishPlatformBroadcast",
    "appendRoomEventJournal",
    "appendPlatformEventJournal"
  ]) {
    if (new RegExp(`\\b${symbol}\\b`).test(source)) {
      issues.push(`Forbidden direct event API "${symbol}"; use transactionWithEvents/transactionWithPlatformEvents`);
    }
  }
  if (rel !== "event-outbox-repository.js") {
    for (const table of ["room_event_journal", "platform_event_journal"]) {
      if (new RegExp(`INSERT\\s+INTO\\s+${table}`, "i").test(source)) {
        issues.push(`Direct INSERT into ${table}; journal writes belong in event-outbox-repository.js`);
      }
    }
  }
  return issues;
}

async function verifySyntax(files) {
  const failures = [];
  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (result.status !== 0) {
      failures.push({ file, error: result.stderr?.trim() || "syntax error" });
    }
  }
  return failures;
}

async function verifyImportGraph() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgres://zhimu:replace_me@127.0.0.1:5432/zhimu";
  }
  process.env.NODE_ENV ??= "test";
  try {
    const { createApp } = await import(pathToFileURL(path.join(srcRoot, "app.js")).href);
    const app = await createApp({ logger: false, allowDemoUserHeader: true });
    await app.inject({ method: "GET", url: "/api/health/live" });
    await app.close();
  } catch (error) {
    return error?.stack || error?.message || String(error);
  }
  return null;
}

const srcFiles = await collectJsFiles(srcRoot);
const scriptFiles = (await collectJsFiles(path.join(backendRoot, "scripts"))).filter(
  (file) => !file.endsWith("verify-modules.mjs") && !file.endsWith("verify-boot.mjs")
);

let failed = false;

const syntaxFailures = await verifySyntax([...srcFiles, ...scriptFiles]);
if (syntaxFailures.length) {
  failed = true;
  console.error("SYNTAX FAILURES:");
  for (const item of syntaxFailures) console.error(`  ${path.relative(backendRoot, item.file)}: ${item.error}`);
}

const pathIssues = [];
for (const file of srcFiles) {
  const source = await fs.readFile(file, "utf8");
  for (const issue of [...checkImportPaths(file, source), ...checkEventOutboxBoundary(file, source)]) {
    pathIssues.push({ file, issue });
  }
}
if (pathIssues.length) {
  failed = true;
  console.error("IMPORT PATH FAILURES:");
  for (const item of pathIssues) {
    console.error(`  ${path.relative(backendRoot, item.file)}: ${item.issue}`);
  }
}

const graphError = await verifyImportGraph();
if (graphError) {
  failed = true;
  console.error("MODULE GRAPH FAILURE (createApp could not load):");
  console.error(graphError);
}

if (failed) {
  console.error("\nverify-modules: FAILED");
  process.exit(1);
}

console.log(`verify-modules: OK (${srcFiles.length} src files, syntax + paths + graph)`);
