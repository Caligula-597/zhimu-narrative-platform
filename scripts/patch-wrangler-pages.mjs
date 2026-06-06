#!/usr/bin/env node
/**
 * Cloudflare Pages runs `npx wrangler deploy` by default for some Vite presets.
 * Static Pages must use `wrangler pages deploy`. Patch local wrangler bin after install.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = "zhimu-pages-deploy-shim";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wranglerBin = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const backupBin = path.join(root, "node_modules", "wrangler", "bin", "wrangler.real.js");

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

const wrapper = `#!/usr/bin/env node
// ${MARKER}
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const real = path.join(__dirname, "wrangler.real.js");
const args = process.argv.slice(2);
if (args[0] === "deploy") {
  const r = spawnSync(process.execPath, [real, "pages", "deploy", ...args.slice(1)], {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd()
  });
  process.exit(r.status ?? 1);
}
const r = spawnSync(process.execPath, [real, ...args], {
  stdio: "inherit",
  env: process.env,
  cwd: process.cwd()
});
process.exit(r.status ?? 1);
`;

fs.writeFileSync(wranglerBin, wrapper);
console.log("[zhimu] patched wrangler: deploy -> pages deploy (static Pages)");
