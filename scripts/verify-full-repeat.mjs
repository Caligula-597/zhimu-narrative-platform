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
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const backend = path.join(root, "backend");
const countArg = process.argv.find((value) => value.startsWith("--count="));
const count = Math.max(1, Number(countArg?.split("=")[1] || 3));

console.log(
  "\n[verify:full:3] isolated DB × unit/integration only — E2E and live API/UI smoke are separate gates\n"
);

for (let iteration = 1; iteration <= count; iteration += 1) {
  console.log(`\n========== verify:isolated run ${iteration}/${count} ==========`);
  const result = spawnSync(process.execPath, [
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
    shell: process.platform === "win32"
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nverify:isolated passed ${count}/${count} runs (E2E not included)`);
