#!/usr/bin/env node
import { spawnSync } from "node:child_process";

if (!String(process.env.ZHIMU_FIXTURE_NAMESPACE ?? "").startsWith("zhimu_verify_")) {
  throw new Error("run-isolated-boot must run inside with-isolated-database");
}

for (const args of [["scripts/migrate.js"], ["scripts/verify-boot.mjs"]]) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
