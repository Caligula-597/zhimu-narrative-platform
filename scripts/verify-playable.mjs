/**
 * Isolated Playable Runtime baseline (P7.2.5 → P7.3).
 * Runs only P7 playable checks — ignores unrelated dirty tree.
 *
 * Usage: npm run verify:playable
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  "shared/playable-project-contracts.js",
  "shared/playable-project-compiler.js",
  "shared/playable-fixtures/warehouse-six.js",
  "shared/playable-content-runtime.js",
  "shared/playable-runtime-effects.js",
  "shared/playable-mechanism-bridge.js",
  "shared/playable-mechanism-execution.js",
  "shared/playable-runtime-errors.js",
  "shared/playable-ending-settlement.js",
  "backend/src/room-playable-runtime-service.js",
  "backend/src/repositories/room-playable-runtime-repository.js",
  "backend/src/routes/host-playable-runtime-routes.js",
  "backend/src/routes/player-playable-runtime-routes.js",
  "host/src/views/host-playable-workspace.js",
  "play/src/views/game-home-views.js",
];

const TESTS = [
  "scripts/playable-project-compiler.test.mjs",
  "scripts/playable-content-runtime.test.mjs",
  "scripts/playable-mechanism-bridge.test.mjs",
  "scripts/playable-runtime-health.test.mjs",
  "scripts/playable-m09-ending.test.mjs",
];

function run(name, cmd) {
  console.log(`\n▶ ${name}\n   ${cmd}`);
  const result = spawnSync(cmd, { cwd: root, shell: true, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\n✗ verify:playable failed at: ${name}`);
    process.exit(result.status || 1);
  }
}

console.log("verify:playable — P7.0–P7.3 isolated baseline");
for (const f of FILES) {
  run(`syntax ${f}`, `node --check "${f}"`);
}
run("playable unit suites", `node --test ${TESTS.join(" ")}`);
run("layer boundaries", "node --test scripts/check-layer-boundaries.mjs");
console.log("\n✓ verify:playable PASS (isolated from dirty tree)");
console.log("Note: full-repo verify:changed may still fail on unrelated dirty files.");
console.log("Known baseline debt: host/test/build.test.mjs expects legacy「解锁本幕分幕」.");
