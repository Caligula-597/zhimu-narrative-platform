#!/usr/bin/env node
/**
 * L1-04 + L1-06 combined ops drills: beta support + backup restore.
 *
 * Usage:
 *   node scripts/run-l1-drills.mjs
 *   node scripts/run-l1-drills.mjs --skip-beta
 *   node scripts/run-l1-drills.mjs --skip-backup
 *   node scripts/run-l1-drills.mjs --skip-staging
 *   node scripts/run-l1-drills.mjs --skip-oncall
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { repoRoot } from "./load-backend-secrets.mjs";

const root = repoRoot();
const args = process.argv.slice(2);
const skipBeta = args.includes("--skip-beta");
const skipBackup = args.includes("--skip-backup");
const skipStaging = args.includes("--skip-staging");
const skipOncall = args.includes("--skip-oncall");

function runStep(label, command, commandArgs, cwd = root) {
  console.log(`\n=== ${label} ===\n`);
  const result = spawnSync(command, commandArgs, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    console.error(`\n✘ ${label} failed (exit ${result.status ?? 1})`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

function tryStep(label, command, commandArgs, cwd = root) {
  console.log(`\n=== ${label} (optional) ===\n`);
  const result = spawnSync(command, commandArgs, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    console.warn(`\n⚠ ${label} skipped or failed — see message above`);
    return false;
  }
  return true;
}

console.log("织幕 L1 运维演练 bundle\n");

if (!skipBeta) {
  runStep("L1-06 Beta Support drill", process.execPath, ["scripts/beta-support-drill.mjs"], path.join(root, "backend"));
}

if (!skipBackup) {
  runStep("L1-04 Backup managed schema clone", process.execPath, ["scripts/verify-backup-restore-managed.mjs"], path.join(root, "backend"));
  tryStep("L1-04 Backup docker pg_dump restore", process.execPath, ["scripts/verify-backup-restore-docker.mjs"], path.join(root, "backend"));
}

if (!skipStaging) {
  tryStep("L1-07 Staging isolation smoke", process.execPath, ["scripts/staging-isolation-smoke.mjs"], root);
}

if (!skipOncall) {
  tryStep("L2-08 Monitoring on-call drill", process.execPath, ["scripts/monitoring-oncall-drill.mjs"], root);
}

tryStep("Guardian product probes", process.execPath, ["scripts/guardian-poll.mjs", "--product-probes"], root);

console.log(process.exitCode ? "\nDrills finished with failures." : "\n✓ All required drills passed.");
