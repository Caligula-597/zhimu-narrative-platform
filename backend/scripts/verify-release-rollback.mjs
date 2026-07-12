#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import "dotenv/config";

function run(label, script) {
  console.log(`\n>> ${label}`);
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(), stdio: "inherit", env: process.env,
    shell: process.platform === "win32"
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("backup -> isolated restore -> full table verification", "scripts/verify-backup-restore.mjs");
run("N-1 -> latest forward migration compatibility", "scripts/verify-migration-upgrade.mjs");
console.log("\nRelease rollback data drills passed. Application image rollback remains a deployment-platform gate.");
