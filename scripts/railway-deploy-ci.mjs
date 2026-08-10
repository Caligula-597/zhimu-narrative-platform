#!/usr/bin/env node
/**
 * CI / local Railway deploy: prefer `railway up` (Project Token), else GraphQL redeploy (Account Token).
 *
 * Env (GitHub Secrets or .env.railway.setup):
 *   RAILWAY_PROJECT_TOKEN    — Project Token → railway up
 *   RAILWAY_TOKEN            — Account/API token fallback
 *   RAILWAY_ACCOUNT_TOKEN    — Account Token → serviceInstanceDeployV2 (GitHub-connected source)
 *   RAILWAY_SERVICE_ID       — default: zhimu-narrative-platform fullstack service
 *   RAILWAY_ENVIRONMENT_ID   — production environment
 *   RAILWAY_PUBLIC_URL       — post-deploy health check base (default https://app.getzhimu.com)
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { deployService, updateServiceInstance, listRecentDeployments, fetchDeployment, fetchBuildLogs, fetchRuntimeLogs } from "./railway-api.mjs";
import { loadExpectedCreatorManifest, probeCreatorFrontendSync } from "./production-frontend-sync.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");

const DEFAULTS = {
  serviceId: "3eeeaee1-11d8-4572-8c95-b912add196d7",
  environmentId: "0a020c66-c4c7-4433-9012-dd45a7b6c575"
};

const FULLSTACK_DOCKERFILE = "deploy/Dockerfile.fullstack";

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

function resolveServiceId(env) {
  return env.RAILWAY_SERVICE_ID?.trim()
    || env.RAILWAY_API_SERVICE_ID?.trim()
    || DEFAULTS.serviceId;
}

function resolveEnvironmentId(env) {
  return env.RAILWAY_ENVIRONMENT_ID?.trim() || DEFAULTS.environmentId;
}

function tryCliDeploy(env) {
  const token = env.RAILWAY_PROJECT_TOKEN?.trim();
  const serviceId = resolveServiceId(env);
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

async function ensureFullstackDockerBuild(env) {
  const token = deployToken(env);
  if (!token) return;
  const serviceId = resolveServiceId(env);
  const environmentId = resolveEnvironmentId(env);
  console.log("[railway-deploy-ci] Ensure fullstack Dockerfile via railway.toml…");
  try {
    await updateServiceInstance(token, {
      serviceId,
      environmentId,
      input: {
        dockerfilePath: FULLSTACK_DOCKERFILE,
        railwayConfigFile: "railway.toml",
        healthcheckPath: "/api/health/ready",
        healthcheckTimeout: 300
      }
    });
  } catch (error) {
    console.warn("[railway-deploy-ci] serviceInstanceUpdate warning:", error.message);
  }
}

async function tryGraphqlRedeploy(env) {
  const token = deployToken(env);
  if (!token) return { ok: false, reason: "no-account-token" };

  await ensureFullstackDockerBuild(env);

  const serviceId = resolveServiceId(env);
  const environmentId = resolveEnvironmentId(env);
  const commitSha = resolveDeployCommitSha(env);

  console.log(`[railway-deploy-ci] GraphQL serviceInstanceDeployV2${commitSha ? ` commit ${commitSha.slice(0, 7)}` : ""} …`);
  await deployService(token, { serviceId, environmentId, commitSha });
  return { ok: true, method: "graphql-deploy" };
}

async function waitForDeployment(token, serviceId, base, {
  sinceMs = Date.now() - 60_000,
  expectedManifest = null
} = {}) {
  let trackedId = null;
  for (let i = 1; i <= 60; i += 1) {
    const recent = await listRecentDeployments(token, serviceId, 6);
    const candidate =
      recent.find((d) => d.id === trackedId)
      ?? recent.find((d) => new Date(d.createdAt).getTime() >= sinceMs)
      ?? recent[0];
    if (!candidate) {
      console.log(`[railway-deploy-ci] Waiting for deployment record (${i}/60)…`);
      await new Promise((r) => setTimeout(r, 10_000));
      continue;
    }
    trackedId = candidate.id;
    const detail = await fetchDeployment(token, trackedId);
    const status = detail?.status ?? candidate.status;
    console.log(`[railway-deploy-ci] Deployment ${trackedId.slice(0, 8)}… status=${status}`);

    if (status === "SUCCESS") {
      const readyRes = await fetch(`${base}/api/health/ready`, { signal: AbortSignal.timeout(12_000) });
      const readyBody = await readyRes.json().catch(() => ({}));
      const configRes = await fetch(`${base}/api/auth/config`, { signal: AbortSignal.timeout(12_000) });
      const configBody = await configRes.json().catch(() => ({}));
      if (readyRes.ok
        && readyBody.ready === true
        && configRes.ok
        && configBody.oauthDiagnostics === undefined
        && configBody.requireEmailVerification === true) {
        try {
          const frontend = await probeCreatorFrontendSync(base, { expectedManifest });
          console.log(`[railway-deploy-ci] Creator synced: ${frontend.manifest.entryScript}`);
          console.log(`[railway-deploy-ci] Release verified at ${base}`);
          return true;
        } catch (error) {
          console.log(`[railway-deploy-ci] Creator frontend still stale: ${error.message}`);
        }
      }
      console.log("[railway-deploy-ci] Service up but release probe still stale — waiting…");
    } else if (status === "FAILED" || status === "CRASHED") {
      const logs = await fetchBuildLogs(token, trackedId, 120);
      const tail = logs.slice(-25).map((l) => l.message).filter(Boolean);
      console.error(`[railway-deploy-ci] Deployment ${status}. Build log tail:`);
      for (const line of tail) console.error(line);
      try {
        const runtime = await fetchRuntimeLogs(token, trackedId, 80);
        const runtimeTail = runtime.map((l) => l.message).filter(Boolean);
        console.error(`[railway-deploy-ci] Runtime log tail (${runtimeTail.length}):`);
        for (const line of runtimeTail) console.error(line);
      } catch (error) {
        console.error(`[railway-deploy-ci] Runtime logs unavailable: ${error.message}`);
      }
      return false;
    } else if (status === "REMOVED") {
      const newer = recent.find((d) => d.id !== trackedId && d.status !== "REMOVED");
      if (newer) {
        trackedId = newer.id;
        continue;
      }
    }

    await new Promise((r) => setTimeout(r, 15_000));
  }
  console.warn("[railway-deploy-ci] Deployment wait timed out");
  return false;
}

async function waitForRelease(base, env, { sinceMs, expectedManifest = null } = {}) {
  const token = deployToken(env);
  const serviceId = resolveServiceId(env);
  if (token) {
    return waitForDeployment(token, serviceId, base, {
      sinceMs: sinceMs ?? Date.now() - 60_000,
      expectedManifest
    });
  }
  return waitForReleaseLegacy(base, expectedManifest);
}

async function waitForReleaseLegacy(base, expectedManifest = null) {
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
      if (configRes.ok
        && configBody.oauthDiagnostics === undefined
        && configBody.requireEmailVerification === true) {
        try {
          const frontend = await probeCreatorFrontendSync(base, { expectedManifest });
          console.log(`[railway-deploy-ci] Creator synced: ${frontend.manifest.entryScript}`);
          console.log(`[railway-deploy-ci] Release verified at ${base} (no oauthDiagnostics)`);
          return true;
        } catch (error) {
          console.log(`[railway-deploy-ci] Creator frontend still stale: ${error.message}`);
        }
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
  const base = (env.RAILWAY_PUBLIC_URL || env.APP_PUBLIC_URL || "https://app.getzhimu.com").replace(/\/$/, "");
  const expectedManifest = loadExpectedCreatorManifest({
    root,
    required: env.REQUIRE_CREATOR_FRONTEND_SYNC === "true"
  });
  if (expectedManifest) {
    console.log(`[railway-deploy-ci] Expected Creator entry: ${expectedManifest.entryScript}`);
  }
  const deployStartedAt = Date.now();

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
      const message = "Set RAILWAY_ACCOUNT_TOKEN (or RAILWAY_TOKEN) in GitHub Secrets";
      if (env.REQUIRE_DEPLOY === "true") {
        console.error(`::error::Production deploy is required. ${message}`);
        process.exit(1);
      }
      console.log(`::notice::Skip deploy — ${message}`);
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
  const released = await waitForRelease(base, env, {
    sinceMs: deployStartedAt - 60_000,
    expectedManifest
  });
  if (!released) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
