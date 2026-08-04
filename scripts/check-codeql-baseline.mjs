#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(root, "config", "codeql-baseline.json");
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

function sarifFiles(target) {
  const absolute = path.resolve(root, target);
  if (!fs.existsSync(absolute)) throw new Error(`CodeQL SARIF target does not exist: ${target}`);
  if (fs.statSync(absolute).isFile()) return [absolute];
  return fs.readdirSync(absolute, { recursive: true })
    .filter((entry) => String(entry).endsWith(".sarif"))
    .map((entry) => path.join(absolute, entry));
}

function resultKey(ruleId, artifactPath) {
  return `${ruleId}\u0000${String(artifactPath || "").replaceAll("\\", "/")}`;
}

function collectFindings(targets) {
  const counts = new Map();
  let total = 0;
  for (const file of targets.flatMap(sarifFiles)) {
    const document = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const run of document.runs ?? []) {
      for (const result of run.results ?? []) {
        const artifactPath = result.locations?.[0]?.physicalLocation?.artifactLocation?.uri;
        const key = resultKey(result.ruleId, artifactPath);
        counts.set(key, (counts.get(key) ?? 0) + 1);
        total += 1;
      }
    }
  }
  return { counts, total };
}

function validateBaselineConfig() {
  const seen = new Set();
  let declaredTotal = 0;
  for (const allowance of baseline.allowances ?? []) {
    const key = resultKey(allowance.ruleId, allowance.path);
    if (seen.has(key)) throw new Error(`Duplicate CodeQL baseline entry: ${allowance.ruleId} ${allowance.path}`);
    if (!Number.isInteger(allowance.maxCount) || allowance.maxCount < 1) {
      throw new Error(`Invalid CodeQL maxCount: ${allowance.ruleId} ${allowance.path}`);
    }
    seen.add(key);
    declaredTotal += allowance.maxCount;
  }
  if (declaredTotal !== baseline.totalFindings) {
    throw new Error(`CodeQL baseline total mismatch: entries=${declaredTotal}, declared=${baseline.totalFindings}`);
  }
}

validateBaselineConfig();
const targets = process.argv.slice(2);
if (!targets.length) throw new Error("Usage: node scripts/check-codeql-baseline.mjs <sarif-file-or-directory> [...]");

const allowed = new Map(
  baseline.allowances.map((item) => [resultKey(item.ruleId, item.path), item.maxCount])
);
const current = collectFindings(targets);
const violations = [];
for (const [key, count] of current.counts) {
  const maxCount = allowed.get(key) ?? 0;
  if (count <= maxCount) continue;
  const [ruleId, artifactPath] = key.split("\u0000");
  violations.push({ ruleId, artifactPath, count, maxCount });
}

console.log(`CodeQL findings: ${current.total}; historical ceiling: ${baseline.totalFindings}`);
if (violations.length) {
  console.error("New or increased CodeQL findings:");
  for (const item of violations) {
    console.error(`  - ${item.ruleId} ${item.artifactPath}: ${item.count} (allowed ${item.maxCount})`);
  }
  process.exit(1);
}
console.log(`CodeQL incremental gate passed; debt reduced by ${baseline.totalFindings - current.total}.`);
