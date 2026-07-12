#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const backend = path.join(root, "backend");
const countArg = process.argv.find((value) => value.startsWith("--count="));
const count = Math.max(1, Number(countArg?.split("=")[1] || 3));

for (let iteration = 1; iteration <= count; iteration += 1) {
  console.log(`\n========== verify:full isolated run ${iteration}/${count} ==========`);
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

console.log(`\nverify:full passed ${count}/${count} isolated runs`);
