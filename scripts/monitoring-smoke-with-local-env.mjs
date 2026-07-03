#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, "backend", ".env");
const env = { ...process.env };

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    if (key === "METRICS_TOKEN" || key === "OPS_API_TOKEN") {
      env[key] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
}

const args = ["scripts/monitoring-smoke.mjs", ...(process.argv.slice(2).length ? process.argv.slice(2) : ["--alerts"])];
const result = spawnSync(process.execPath, args, { env, cwd: root, stdio: "inherit" });
process.exit(result.status ?? 1);
