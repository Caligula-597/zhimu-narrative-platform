#!/usr/bin/env node
/**
 * Cloudflare Pages Git: build produces dist/, deploy command only needs exit 0.
 * Do NOT call wrangler pages deploy here — that needs a separate API token with Pages scope.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distIndex = path.join(root, "dist", "index.html");

if (!fs.existsSync(distIndex)) {
  console.error("[cf-pages] dist/index.html missing — run npm run build first.");
  process.exit(1);
}

console.log("[cf-pages] dist/ ready — Pages Git will publish build output (no wrangler API call).");
process.exit(0);
