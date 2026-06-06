#!/usr/bin/env node
/**
 * Deploy frontend (web/) to Railway — repo root context, web/Dockerfile.
 *
 * Prereq: Railway project with a separate **Web** service (not the API service).
 *   railway login
 *   railway link   # pick Web service
 *
 * Env: RAILWAY_TOKEN + RAILWAY_WEB_SERVICE_ID (GitHub Actions / CI)
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = ["up", "--ci"];
const serviceId = process.env.RAILWAY_WEB_SERVICE_ID;
if (serviceId) {
  args.push("--service", serviceId);
}

const result = spawnSync("railway", args, {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env
});

if (result.error?.code === "ENOENT") {
  console.error("\nrailway-deploy-web: Railway CLI not found. Run: npm i -g @railway/cli && railway login");
  process.exit(1);
}

process.exit(result.status ?? 1);
