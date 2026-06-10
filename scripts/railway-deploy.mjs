#!/usr/bin/env node
/**
 * Deploy backend API to Railway (backend/ only — never uploads monorepo root).
 *
 * Prereq (once):
 *   npm i -g @railway/cli
 *   railway login
 *   railway link   # pick zhimu project + API service
 *
 * Or CI: set RAILWAY_TOKEN + RAILWAY_SERVICE_ID in GitHub Secrets.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = path.join(root, "backend");

const args = ["up", "--ci"];
if (process.env.RAILWAY_SERVICE_ID) {
  args.push("--service", process.env.RAILWAY_SERVICE_ID);
}

const result = spawnSync("railway", args, {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env
});

if (result.error?.code === "ENOENT") {
  console.error("\nrailway-deploy: Railway CLI not found. Run: npm i -g @railway/cli && railway login");
  process.exit(1);
}

process.exit(result.status ?? 1);
