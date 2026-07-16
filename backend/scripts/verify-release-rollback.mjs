#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import "dotenv/config";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const drills = [
  {
    id: "backup-restore",
    label: "backup -> isolated restore -> full table verification",
    script: "verify-backup-restore.mjs"
  },
  {
    id: "forward-migration",
    label: "N-1 -> latest forward migration compatibility",
    script: "verify-migration-upgrade.mjs"
  }
];

export function parseRollbackOptions(argv = []) {
  const unknownArgs = argv.filter((value) => !value.startsWith("--out="));
  if (unknownArgs.length) throw new TypeError(`unknown argument: ${unknownArgs[0]}`);
  const outArgs = argv.filter((value) => value.startsWith("--out="));
  if (outArgs.length > 1) throw new TypeError("--out may only be provided once");
  const rawOutput = outArgs[0]?.slice("--out=".length);
  if (outArgs.length && !rawOutput) throw new TypeError("--out requires a file path");
  return { outputPath: rawOutput ? path.resolve(backendRoot, rawOutput) : null };
}

function writeEvidence(outputPath, report) {
  if (!outputPath) return;
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[release-rollback] evidence: ${path.relative(backendRoot, outputPath)}`);
}

export function runRollbackVerification({ outputPath }, runProcess = spawnSync) {
  const startedAt = new Date();
  const results = [];
  let exitCode = 0;

  for (const drill of drills) {
    console.log(`\n>> ${drill.label}`);
    const drillStartedAt = new Date();
    const result = runProcess(process.execPath, [path.join(backendRoot, "scripts", drill.script)], {
      cwd: backendRoot,
      stdio: "inherit",
      env: process.env,
      shell: false
    });
    const drillExitCode = result.error ? 1 : (result.status ?? 1);
    results.push({
      id: drill.id,
      label: drill.label,
      status: drillExitCode === 0 ? "passed" : "failed",
      exitCode: drillExitCode,
      signal: result.signal ?? null,
      startedAt: drillStartedAt.toISOString(),
      durationMs: Date.now() - drillStartedAt.getTime()
    });
    if (drillExitCode !== 0) {
      exitCode = drillExitCode;
      break;
    }
  }

  const finishedAt = new Date();
  const passed = results.filter((result) => result.status === "passed").length;
  const report = {
    schemaVersion: 1,
    gate: "release-data-recovery",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    revision: process.env.GITHUB_SHA || null,
    status: exitCode === 0 && passed === drills.length ? "passed" : "failed",
    expectedDrills: drills.map(({ id, label }) => ({ id, label })),
    completedDrills: results.length,
    passedDrills: passed,
    applicationImageRollbackCovered: false,
    applicationImageRollbackNote: "Deployment-platform rollback is a separate required release gate.",
    results
  };
  writeEvidence(outputPath, report);

  if (report.status !== "passed") {
    console.error(`\nRelease rollback data drills failed after ${results.length}/${drills.length} steps.`);
    return exitCode || 1;
  }
  console.log("\nRelease rollback data drills passed. Application image rollback remains a deployment-platform gate.");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseRollbackOptions(process.argv.slice(2));
    process.exitCode = runRollbackVerification(options);
  } catch (error) {
    console.error(`release rollback configuration error: ${error.message}`);
    process.exitCode = 2;
  }
}
