/**
 * Ensure Postgres has fixture + official example before Playwright webServers start.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(label, args) {
  console.log(`\n[e2e setup] ${label}`);
  const result = spawnSync(npm, args, {
    cwd: backend,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    throw new Error(`E2E global setup failed: ${label}`);
  }
}

export default async function globalSetup() {
  run("db:migrate", ["run", "db:migrate"]);
  run("db:seed", ["run", "db:seed"]);
  run("demo:seed-exploration", ["run", "demo:seed-exploration"]);
  run("e2e:reset-fixture-room", ["run", "e2e:reset-fixture-room"]);
}
