#!/usr/bin/env node
/**
 * Repeat isolated-database full-chain runs (backend + frontend unit/integration).
 *
 * Intentionally NOT a complete release gate:
 *   - always --skip-e2e (Playwright runs in release-acceptance / local full-chain)
 *   - always --allow-offline (no live :4180/:4173 smoke required)
 *
 * Treat this as the isolated-DB flake gate. Pair with E2E before production ship.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");

export function parseRepeatOptions(argv = []) {
  const unknownArgs = argv.filter((value) => !value.startsWith("--count=") && !value.startsWith("--out="));
  if (unknownArgs.length) throw new TypeError(`unknown argument: ${unknownArgs[0]}`);
  const countArgs = argv.filter((value) => value.startsWith("--count="));
  const outArgs = argv.filter((value) => value.startsWith("--out="));
  if (countArgs.length > 1) throw new TypeError("--count may only be provided once");
  if (outArgs.length > 1) throw new TypeError("--out may only be provided once");

  const rawCount = countArgs[0]?.slice("--count=".length);
  const count = rawCount == null ? 3 : Number(rawCount);
  if (!Number.isSafeInteger(count) || count < 1 || count > 10) {
    throw new RangeError("--count must be an integer from 1 to 10");
  }

  const rawOutput = outArgs[0]?.slice("--out=".length);
  if (outArgs.length && !rawOutput) throw new TypeError("--out requires a file path");
  return {
    count,
    outputPath: rawOutput ? path.resolve(root, rawOutput) : null
  };
}

function writeEvidence(outputPath, report) {
  if (!outputPath) return;
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[verify:isolated] evidence: ${path.relative(root, outputPath)}`);
}

export function runRepeatedVerification({ count, outputPath }, runProcess = spawnSync) {
  const startedAt = new Date();
  const runs = [];
  let exitCode = 0;

  console.log(
    "\n[verify:isolated] isolated DB × unit/integration only — E2E and live API/UI smoke are separate gates\n"
  );

  for (let iteration = 1; iteration <= count; iteration += 1) {
    console.log(`\n========== verify:isolated run ${iteration}/${count} ==========`);
    const runStartedAt = new Date();
    const result = runProcess(process.execPath, [
      path.join("scripts", "with-isolated-database.mjs"),
      "--",
      process.execPath,
      path.join("..", "scripts", "full-chain.mjs"),
      "--fresh",
      "--skip-e2e",
      "--allow-offline"
    ], {
      cwd: backend,
      stdio: "inherit",
      env: process.env,
      shell: false
    });
    const runExitCode = result.error ? 1 : (result.status ?? 1);
    runs.push({
      iteration,
      status: runExitCode === 0 ? "passed" : "failed",
      exitCode: runExitCode,
      signal: result.signal ?? null,
      startedAt: runStartedAt.toISOString(),
      durationMs: Date.now() - runStartedAt.getTime(),
      isolatedDatabase: true,
      includesE2e: false,
      includesLiveSmoke: false
    });
    if (runExitCode !== 0) {
      exitCode = runExitCode;
      break;
    }
  }

  const finishedAt = new Date();
  const passed = runs.filter((run) => run.status === "passed").length;
  const report = {
    schemaVersion: 1,
    gate: "isolated-unit-integration-repeat",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    revision: process.env.GITHUB_SHA || null,
    requestedRuns: count,
    completedRuns: runs.length,
    passedRuns: passed,
    status: exitCode === 0 && passed === count ? "passed" : "failed",
    scope: {
      isolatedDatabase: true,
      e2e: false,
      liveApiUiSmoke: false
    },
    runs
  };
  writeEvidence(outputPath, report);

  if (report.status !== "passed") {
    console.error(`\nverify:isolated failed after ${runs.length}/${count} runs`);
    return exitCode || 1;
  }
  console.log(`\nverify:isolated passed ${count}/${count} runs (E2E not included)`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseRepeatOptions(process.argv.slice(2));
    process.exitCode = runRepeatedVerification(options);
  } catch (error) {
    console.error(`verify:isolated configuration error: ${error.message}`);
    process.exitCode = 2;
  }
}
