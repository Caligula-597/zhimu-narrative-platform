#!/usr/bin/env node
/**
 * Cloudflare Pages deploy step fallback.
 * Prefer letting patched wrangler handle `npx wrangler deploy`; this script is for explicit use.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distIndex = path.join(root, "dist", "index.html");

if (!fs.existsSync(distIndex)) {
  console.error("[cf-pages] dist/index.html missing — run npm run build first.");
  process.exit(1);
}

const wranglerBin = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
if (fs.existsSync(wranglerBin) && process.env.CLOUDFLARE_API_TOKEN) {
  const r = spawnSync(process.execPath, [wranglerBin, "pages", "deploy"], {
    stdio: "inherit",
    env: process.env,
    cwd: root
  });
  process.exit(r.status ?? 1);
}

console.log("[cf-pages] dist/ ready — Pages will publish build output.");
process.exit(0);
