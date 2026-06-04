/**
 * Local bootstrap: migrate, seed demo world, seed exploration chain.
 * Requires DATABASE_URL (see .env.example).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(here, "..");

function run(label, script) {
  console.log(`\n>> ${label}`);
  const result = spawnSync(process.execPath, [script], {
    cwd: backendRoot,
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("db:migrate", path.join("scripts", "migrate.js"));
run("db:seed", path.join("scripts", "seed.js"));
run("demo:seed-exploration", path.join("scripts", "seed-exploration.js"));

console.log(`
Bootstrap complete.

Next steps:
  Terminal A: cd backend && npm run dev          # http://localhost:4180
  Terminal B: node server.js                     # http://localhost:4173 (project root)
  Terminal C: cd backend && npm test
              cd backend && npm run test:smoke   # after servers are up

See ALPHA_ASSESSMENT.md and DATABASE_SCHEMA.md for full matrix.
`);
