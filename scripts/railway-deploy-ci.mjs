#!/usr/bin/env node
/**
 * CI / local Railway deploy: prefer `railway up` (Project Token), else GraphQL redeploy (Account Token).
 *
 * Env (GitHub Secrets or .env.railway.setup):
 *   RAILWAY_TOKEN            — Project Token → railway up
 *   RAILWAY_ACCOUNT_TOKEN    — Account Token → serviceInstanceDeployV2 (GitHub-connected source)
 *   RAILWAY_SERVICE_ID       — default: zhimu-narrative-platform fullstack service
 *   RAILWAY_ENVIRONMENT_ID   — production environment
 *   RAILWAY_PUBLIC_URL       — post-deploy health check base (default https://app.getzhimu.com)
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { deployService } from "./railway-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");

const DEFAULTS = {
  serviceId: "fc78dfb7-98dc-4ca5-8a9e-4cb9a9db80b1",
  environmentId: "e3b187d0-75ba-49a3-ba92-16168dd5fb68"
};

function loadSetup() {
  const env = { ...process.env };
  if (!fs.existsSync(setupPath)) return env;
  for (const line of fs.readFileSync(setupPath, "utf8").split("\n")) {
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

function tryCliDeploy(env) {
  const token = env.RAILWAY_TOKEN?.trim();
  const serviceId = env.RAILWAY_SERVICE_ID?.trim() || DEFAULTS.serviceId;
  if (!token) return { ok: false, reason: "no-project-token" };

  const whoami = spawnSync("railway", ["whoami"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...env, RAILWAY_TOKEN: token }
  });
  if (whoami.status !== 0) {
    return { ok: false, reason: "invalid-project-token" };
  }

  console.log("[railway-deploy-ci] railway up --ci …");
  const up = spawnSync("railway", ["up", "--ci", "--service", serviceId], {
    stdio: "inherit",
    shell: process.platform === "win32",
    cwd: root,
    env: { ...env, RAILWAY_TOKEN: token }
  });
  if (up.status !== 0) return { ok: false, reason: "cli-failed" };
  return { ok: true, method: "cli" };
}

async function tryGraphqlRedeploy(env) {
  const token = env.RAILWAY_ACCOUNT_TOKEN?.trim();
  if (!token) return { ok: false, reason: "no-account-token" };

  const serviceId = env.RAILWAY_SERVICE_ID?.trim() || DEFAULTS.serviceId;
  const environmentId = env.RAILWAY_ENVIRONMENT_ID?.trim() || DEFAULTS.environmentId;

  console.log("[railway-deploy-ci] GraphQL serviceInstanceDeployV2 (GitHub source) …");
  await deployService(token, { serviceId, environmentId });
  return { ok: true, method: "graphql-redeploy" };
}

async function waitForReady(base) {
  for (let i = 1; i <= 30; i += 1) {
    try {
      const res = await fetch(`${base}/api/health/ready`, { signal: AbortSignal.timeout(12_000) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ready === true) {
        console.log(`[railway-deploy-ci] Ready at ${base}`);
        return true;
      }
    } catch {
      /* retry */
    }
    console.log(`[railway-deploy-ci] Waiting… (${i}/30)`);
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.warn("[railway-deploy-ci] Health check timed out");
  return false;
}

async function main() {
  const env = loadSetup();
  const base = (env.RAILWAY_PUBLIC_URL || "https://app.getzhimu.com").replace(/\/$/, "");

  let result = tryCliDeploy(env);
  if (!result.ok && (result.reason === "invalid-project-token" || result.reason === "no-project-token" || result.reason === "cli-failed")) {
    console.log(`[railway-deploy-ci] CLI skipped (${result.reason})`);
    try {
      result = await tryGraphqlRedeploy(env);
    } catch (error) {
      console.error("[railway-deploy-ci] GraphQL redeploy failed:", error.message);
      result = { ok: false, reason: "graphql-failed" };
    }
  }

  if (!result.ok) {
    if (result.reason === "no-account-token" && !env.RAILWAY_TOKEN?.trim()) {
      console.log("::notice::Skip deploy — set RAILWAY_ACCOUNT_TOKEN or valid RAILWAY_TOKEN in GitHub Secrets");
      process.exit(0);
    }
    if (result.reason === "invalid-project-token") {
      console.error("::error::RAILWAY_TOKEN is set but invalid. Update GitHub Secret or delete it and use RAILWAY_ACCOUNT_TOKEN.");
      process.exit(1);
    }
    console.error(`::error::Deploy failed (${result.reason})`);
    process.exit(1);
  }

  console.log(`[railway-deploy-ci] Deploy triggered via ${result.method}`);
  const ready = await waitForReady(base);
  if (!ready) process.exit(1);

  const verify = spawnSync(process.execPath, [path.join(root, "scripts", "verify-production-release.mjs")], {
    cwd: root,
    stdio: "inherit",
    env: { ...env, RAILWAY_PUBLIC_URL: base }
  });
  process.exit(verify.status ?? 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
