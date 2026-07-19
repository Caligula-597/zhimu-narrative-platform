#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const testFiles = process.argv.slice(2);
if (!String(process.env.ZHIMU_FIXTURE_NAMESPACE ?? "").startsWith("zhimu_verify_")) {
  throw new Error("run-isolated-focused-tests must run inside with-isolated-database");
}
if (!testFiles.length || testFiles.some((file) => !/^test\/[\w.-]+\.test\.(?:js|mjs)$/.test(file))) {
  throw new Error("Usage: run-isolated-focused-tests test/example.test.js [...]");
}

const env = {
  ...process.env,
  ZHIMU_ALLOW_TEST_DB_WRITES: "1",
  OBJECT_STORAGE_PROVIDER: "memory"
};
const commands = [
  ["scripts/migrate.js"],
  ["scripts/seed.js"],
  ["--test-concurrency=1", "--import", "./test/hooks.mjs", "--test", ...testFiles]
];

for (const args of commands) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
