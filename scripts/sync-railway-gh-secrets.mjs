#!/usr/bin/env node
/** Sync Railway deploy and production-check secrets to GitHub Actions. */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");
const railwayEnvPath = path.join(root, ".env.railway");
const REPO = "Caligula-597/zhimu-narrative-platform";

function loadEnvFile(filePath, env) {
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!env[k]) env[k] = v;
  }
  return env;
}

function loadSetup() {
  const env = { ...process.env };
  loadEnvFile(setupPath, env);
  loadEnvFile(railwayEnvPath, env);
  return env;
}

function syncSecret(name, value) {
  if (!value) {
    console.warn(`[sync-gh-secrets] skip ${name} (empty)`);
    return false;
  }
  const gh = spawnSync("gh", ["secret", "set", name, "--body", value, "-R", REPO], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      HTTP_PROXY: process.env.HTTP_PROXY || "http://127.0.0.1:7890",
      HTTPS_PROXY: process.env.HTTPS_PROXY || "http://127.0.0.1:7890"
    }
  });
  return gh.status === 0;
}

const setup = loadSetup();
const accountToken = setup.RAILWAY_ACCOUNT_TOKEN?.trim() || setup.RAILWAY_TOKEN?.trim();
const projectToken = setup.RAILWAY_PROJECT_TOKEN?.trim();

console.log("[sync-gh-secrets] Updating GitHub Actions secrets...");
if (accountToken) syncSecret("RAILWAY_ACCOUNT_TOKEN", accountToken);
if (projectToken) syncSecret("RAILWAY_TOKEN", projectToken);
syncSecret("RAILWAY_SERVICE_ID", setup.RAILWAY_API_SERVICE_ID || "fc78dfb7-98dc-4ca5-8a9e-4cb9a9db80b1");
syncSecret("RAILWAY_ENVIRONMENT_ID", setup.RAILWAY_ENVIRONMENT_ID || "e3b187d0-75ba-49a3-ba92-16168dd5fb68");
syncSecret("RAILWAY_PUBLIC_URL", setup.APP_PUBLIC_URL?.trim() || "https://app.getzhimu.com");
syncSecret("OPS_API_TOKEN", setup.OPS_API_TOKEN?.trim());
syncSecret("METRICS_TOKEN", setup.METRICS_TOKEN?.trim());
console.log("[sync-gh-secrets] Done");
