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

function deployToken(env) {
  return env.RAILWAY_ACCOUNT_TOKEN?.trim() || env.RAILWAY_TOKEN?.trim() || "";
}

function tryCliDeploy(env) {
  const token = env.RAILWAY_PROJECT_TOKEN?.trim();
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

function resolveDeployCommitSha(env) {
  const explicit = env.RAILWAY_DEPLOY_COMMIT_SHA?.trim() || env.GITHUB_SHA?.trim();
  if (explicit) return explicit;
  const rev = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: root });
  if (rev.status === 0) return rev.stdout.trim();
  return null;
}

async function tryGraphqlRedeploy(env) {
  const token = deployToken(env);
  if (!token) return { ok: false, reason: "no-account-token" };

  const serviceId = env.RAILWAY_SERVICE_ID?.trim() || DEFAULTS.serviceId;
  const environmentId = env.RAILWAY_ENVIRONMENT_ID?.trim() || DEFAULTS.environmentId;
  const commitSha = resolveDeployCommitSha(env);

  console.log(`[railway-deploy-ci] GraphQL serviceInstanceDeployV2${commitSha ? ` commit ${commitSha.slice(0, 7)}` : ""} …`);
  await deployService(token, { serviceId, environmentId, commitSha });
  return { ok: true, method: "graphql-deploy" };
}

async function waitForRelease(base) {
  for (let i = 1; i <= 40; i += 1) {
    try {
      const readyRes = await fetch(`${base}/api/health/ready`, { signal: AbortSignal.timeout(12_000) });
      const readyBody = await readyRes.json().catch(() => ({}));
      if (!readyRes.ok || readyBody.ready !== true) {
        console.log(`[railway-deploy-ci] Service not ready (${i}/40)…`);
        await new Promise((r) => setTimeout(r, 10_000));
        continue;
      }

      const configRes = await fetch(`${base}/api/auth/config`, { signal: AbortSignal.timeout(12_000) });
      const configBody = await configRes.json().catch(() => ({}));
      if (configRes.ok && configBody.oauthDiagnostics === undefined) {
        console.log(`[railway-deploy-ci] Release verified at ${base} (no oauthDiagnostics)`);
        return true;
      }
      console.log(`[railway-deploy-ci] Waiting for new build to roll out (${i}/40)…`);
    } catch (error) {
      console.log(`[railway-deploy-ci] Probe failed (${i}/40): ${error.message}`);
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
  console.warn("[railway-deploy-ci] Release verification timed out");
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
    if (result.reason === "no-account-token" && !deployToken(env)) {
      console.log("::notice::Skip deploy — set RAILWAY_ACCOUNT_TOKEN (or RAILWAY_TOKEN) in GitHub Secrets");
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
  const released = await waitForRelease(base);
  if (!released) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
