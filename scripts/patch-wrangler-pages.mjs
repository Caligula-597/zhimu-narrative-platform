#!/usr/bin/env node
/**
 * Cloudflare Pages runs `npx wrangler deploy` by default for some Vite presets.
 * Replace with a no-op that verifies dist/ — Pages Git publishes dist when this exits 0.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = "zhimu-pages-deploy-shim-v2";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wranglerBin = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const backupBin = path.join(root, "node_modules", "wrangler", "bin", "wrangler.real.js");
const deployShim = path.join(root, "scripts", "wrangler-pages-deploy-shim.mjs");

if (!fs.existsSync(wranglerBin)) {
  console.log("[zhimu] wrangler not installed — skip Pages deploy shim");
  process.exit(0);
}

const current = fs.readFileSync(wranglerBin, "utf8");
if (current.includes(MARKER)) {
  process.exit(0);
}

if (!fs.existsSync(backupBin)) {
  fs.copyFileSync(wranglerBin, backupBin);
}

const shimPath = deployShim.replace(/\\/g, "/");

const wrapper = `#!/usr/bin/env node
// ${MARKER}
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const real = path.join(__dirname, "wrangler.real.js");
const args = process.argv.slice(2);
if (args[0] === "deploy") {
  const shim = ${JSON.stringify(shimPath)};
  if (fs.existsSync(shim)) {
    const r = spawnSync(process.execPath, [shim], {
      stdio: "inherit",
      env: process.env,
      cwd: process.cwd()
    });
    process.exit(r.status ?? 1);
  }
}
const r = spawnSync(process.execPath, [real, ...args], {
  stdio: "inherit",
  env: process.env,
  cwd: process.cwd()
});
process.exit(r.status ?? 1);
`;

fs.writeFileSync(wranglerBin, wrapper);
console.log("[zhimu] patched wrangler deploy -> static Pages noop (dist/ only)");
