#!/usr/bin/env node
/**
 * Patch local wrangler so `deploy` is a static Pages noop (no Cloudflare API).
 * Runs on postinstall + prebuild every time (Cloudflare may cache node_modules).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = "zhimu-pages-deploy-shim-v3";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wranglerBin = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const backupBin = path.join(root, "node_modules", "wrangler", "bin", "wrangler.real.js");

if (!fs.existsSync(wranglerBin)) {
  console.log("[zhimu] wrangler not installed — skip Pages deploy shim");
  process.exit(0);
}

if (!fs.existsSync(backupBin)) {
  fs.copyFileSync(wranglerBin, backupBin);
}

const wrapper = `#!/usr/bin/env node
// ${MARKER}
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const real = path.join(__dirname, "wrangler.real.js");
const args = process.argv.slice(2);
if (args[0] === "deploy") {
  const shim = path.join(process.cwd(), "scripts", "wrangler-pages-deploy-shim.mjs");
  if (fs.existsSync(shim)) {
    const r = spawnSync(process.execPath, [shim], {
      stdio: "inherit",
      env: process.env,
      cwd: process.cwd()
    });
    process.exit(r.status ?? 1);
  }
  console.log("[cf-pages] deploy shim missing — skipping wrangler API");
  process.exit(0);
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
