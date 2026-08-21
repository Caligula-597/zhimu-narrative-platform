#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchDeployment, rollbackDeployment } from "./railway-api.mjs";

function arg(argv, name, fallback = "") {
  const exact = argv.find((item) => item === name);
  if (exact) return "true";
  const item = argv.find((value) => value.startsWith(`${name}=`));
  return item ? item.slice(name.length + 1) : fallback;
}

function required(value, label) {
  const result = String(value || "").trim();
  if (!result) throw new Error(`${label} is required`);
  return result;
}

function revision(raw, label) {
  const value = required(raw, label).toLowerCase();
  if (!/^[a-f0-9]{40}$/u.test(value)) throw new Error(`${label} must be a 40-character Git SHA`);
  return value;
}

export function parseRailwayRollbackOptions(argv = process.argv.slice(2), env = process.env) {
  if (String(arg(argv, "--environment", "")).toLowerCase() !== "staging") {
    throw new Error("--environment=staging is required; production rollbacks are refused");
  }
  if (arg(argv, "--confirm-rollback", "false") !== "true") {
    throw new Error("--confirm-rollback is required because this changes the staging deployment twice");
  }
  const environmentId = required(env.RAILWAY_ENVIRONMENT_ID, "RAILWAY_ENVIRONMENT_ID");
  if (arg(argv, "--confirm-environment-id", "") !== environmentId) {
    throw new Error("--confirm-environment-id must exactly match RAILWAY_ENVIRONMENT_ID");
  }
  const baseUrl = required(arg(argv, "--url", env.RAILWAY_PUBLIC_URL || ""), "--url").replace(/\/$/u, "");
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "https:") throw new Error("staging rollback probes must use HTTPS");
  if (arg(argv, "--confirm-host", "").toLowerCase() !== parsed.hostname.toLowerCase()) {
    throw new Error(`--confirm-host must exactly match ${parsed.hostname}`);
  }
  const candidateDeploymentId = required(arg(argv, "--candidate-deployment-id", ""), "--candidate-deployment-id");
  const stableDeploymentId = required(arg(argv, "--stable-deployment-id", ""), "--stable-deployment-id");
  if (candidateDeploymentId === stableDeploymentId) throw new Error("candidate and stable deployment IDs must differ");
  return {
    environment: "staging",
    environmentId,
    serviceId: required(env.RAILWAY_SERVICE_ID, "RAILWAY_SERVICE_ID"),
    token: required(env.RAILWAY_ACCOUNT_TOKEN, "RAILWAY_ACCOUNT_TOKEN"),
    baseUrl,
    candidateDeploymentId,
    candidateRevision: revision(arg(argv, "--candidate-revision", ""), "--candidate-revision"),
    stableDeploymentId,
    stableRevision: revision(arg(argv, "--stable-revision", ""), "--stable-revision"),
    health: {
      loginEmail: required(env.RECOVERY_LOGIN_EMAIL, "RECOVERY_LOGIN_EMAIL"),
      loginPassword: required(env.RECOVERY_LOGIN_PASSWORD, "RECOVERY_LOGIN_PASSWORD"),
      creatorToken: required(env.RECOVERY_CREATOR_BEARER_TOKEN, "RECOVERY_CREATOR_BEARER_TOKEN"),
      playerToken: required(env.RECOVERY_PLAYER_BEARER_TOKEN, "RECOVERY_PLAYER_BEARER_TOKEN"),
      hostToken: required(env.RECOVERY_HOST_BEARER_TOKEN, "RECOVERY_HOST_BEARER_TOKEN"),
      worldId: required(env.RECOVERY_WORLD_ID, "RECOVERY_WORLD_ID"),
      roomId: required(env.RECOVERY_ROOM_ID, "RECOVERY_ROOM_ID")
    },
    timeoutMs: Number(arg(argv, "--timeout-ms", "900000")),
    pollMs: Number(arg(argv, "--poll-ms", "10000")),
    out: required(arg(argv, "--out", ""), "--out")
  };
}

export function deploymentRevision(deployment) {
  const meta = deployment?.meta || {};
  const values = [
    meta.commitHash,
    meta.commitSha,
    meta.source?.commitHash,
    meta.source?.commitSha,
    meta.repoCommit,
    meta.gitCommit
  ];
  return values.find((value) => /^[a-f0-9]{40}$/iu.test(String(value || "")))?.toLowerCase() || "";
}

async function waitForDeployment(token, deploymentId, expectedRevision, {
  fetchDeploymentImpl,
  timeoutMs,
  pollMs,
  waitImpl
}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const deployment = await fetchDeploymentImpl(token, deploymentId);
    const status = String(deployment?.status || "").toUpperCase();
    if (status === "SUCCESS") {
      const actualRevision = deploymentRevision(deployment);
      if (!actualRevision) throw new Error(`deployment ${deploymentId} does not expose an auditable commit revision`);
      if (actualRevision !== expectedRevision) throw new Error(`deployment ${deploymentId} revision mismatch`);
      return deployment;
    }
    if (new Set(["FAILED", "CRASHED", "REMOVED"]).has(status)) {
      throw new Error(`deployment ${deploymentId} entered terminal status ${status}`);
    }
    await waitImpl(pollMs);
  }
  throw new Error(`deployment ${deploymentId} did not become SUCCESS before timeout`);
}

async function probeSse(baseUrl, health, fetchImpl) {
  const response = await fetchImpl(`${baseUrl}/api/rooms/${encodeURIComponent(health.roomId)}/events/stream`, {
    headers: { authorization: `Bearer ${health.playerToken}`, accept: "text/event-stream" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok || !response.body) return { passed: false, status: response.status };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let passed = false;
  try {
    while (buffer.length < 64 * 1024) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (/data:\s*\{[^\n]*"type"\s*:\s*"connected"/u.test(buffer)) {
        passed = true;
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return { passed, status: response.status };
}

async function probeApplication(baseUrl, health, fetchImpl) {
  const definitions = [
    { id: "live", path: "/api/health/live", validate: (body) => body?.ok === true },
    { id: "ready", path: "/api/health/ready", validate: (body) => body?.ready === true },
    {
      id: "login",
      path: "/api/auth/login",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: health.loginEmail, password: health.loginPassword }),
      validate: (body) => body?.user?.id || body?.id || body?.ok === true
    },
    {
      id: "creator-read",
      path: `/api/worlds/${encodeURIComponent(health.worldId)}`,
      headers: { authorization: `Bearer ${health.creatorToken}` },
      validate: (body) => Boolean(body?.id)
    },
    {
      id: "player-home",
      path: `/api/rooms/${encodeURIComponent(health.roomId)}/player-home`,
      headers: { authorization: `Bearer ${health.playerToken}` },
      validate: (body) => Boolean(body && typeof body === "object")
    },
    {
      id: "host-console",
      path: `/api/rooms/${encodeURIComponent(health.roomId)}/host/players`,
      headers: { authorization: `Bearer ${health.hostToken}` },
      validate: (body) => Array.isArray(body) || Array.isArray(body?.items) || Boolean(body && typeof body === "object")
    }
  ];
  const checks = [];
  for (const definition of definitions) {
    const started = Date.now();
    try {
      const response = await fetchImpl(`${baseUrl}${definition.path}`, {
        method: definition.method || "GET",
        headers: definition.headers,
        body: definition.body,
        signal: AbortSignal.timeout(15_000)
      });
      const body = await response.json().catch(() => null);
      checks.push({
        id: definition.id,
        passed: response.ok && definition.validate(body),
        status: response.status,
        latencyMs: Date.now() - started
      });
    } catch (error) {
      checks.push({ id: definition.id, passed: false, status: 0, latencyMs: Date.now() - started, error: error?.name || "FETCH_ERROR" });
    }
  }
  const sseStarted = Date.now();
  try {
    const sse = await probeSse(baseUrl, health, fetchImpl);
    checks.push({ id: "sse", passed: sse.passed, status: sse.status, latencyMs: Date.now() - sseStarted });
  } catch (error) {
    checks.push({ id: "sse", passed: false, status: 0, latencyMs: Date.now() - sseStarted, error: error?.name || "SSE_ERROR" });
  }
  if (checks.some((check) => !check.passed)) throw new Error("post-rollback application probes failed");
  return checks;
}

export async function runRailwayRollbackDrill(options, {
  rollbackDeploymentImpl = rollbackDeployment,
  fetchDeploymentImpl = fetchDeployment,
  fetchImpl = fetch,
  waitImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
} = {}) {
  if (options.environment !== "staging") throw new Error("rollback drill refuses non-staging environments");
  const candidate = await fetchDeploymentImpl(options.token, options.candidateDeploymentId);
  const stable = await fetchDeploymentImpl(options.token, options.stableDeploymentId);
  if (deploymentRevision(candidate) !== options.candidateRevision) throw new Error("candidate deployment revision mismatch before drill");
  if (deploymentRevision(stable) !== options.stableRevision) throw new Error("stable deployment revision mismatch before drill");

  const startedAt = new Date().toISOString();
  const rollbackStarted = Date.now();
  const rollback = await rollbackDeploymentImpl(options.token, options.stableDeploymentId);
  const restoredDeploymentId = required(rollback?.id, "Railway rollback deployment id");
  await waitForDeployment(options.token, restoredDeploymentId, options.stableRevision, {
    fetchDeploymentImpl,
    timeoutMs: options.timeoutMs,
    pollMs: options.pollMs,
    waitImpl
  });
  const stableChecks = await probeApplication(options.baseUrl, options.health, fetchImpl);
  const stableRestoredAt = new Date().toISOString();

  const candidateRestore = await rollbackDeploymentImpl(options.token, options.candidateDeploymentId);
  const candidateRestoredDeploymentId = required(candidateRestore?.id, "Railway candidate restore deployment id");
  await waitForDeployment(options.token, candidateRestoredDeploymentId, options.candidateRevision, {
    fetchDeploymentImpl,
    timeoutMs: options.timeoutMs,
    pollMs: options.pollMs,
    waitImpl
  });
  const candidateChecks = await probeApplication(options.baseUrl, options.health, fetchImpl);

  return {
    schemaVersion: 1,
    drill: "railway-exact-image-rollback",
    environment: "staging",
    serviceId: options.serviceId,
    environmentId: options.environmentId,
    startedAt,
    finishedAt: new Date().toISOString(),
    candidate: { deploymentId: options.candidateDeploymentId, revision: options.candidateRevision },
    stable: { deploymentId: options.stableDeploymentId, revision: options.stableRevision },
    rollback: {
      deploymentId: restoredDeploymentId,
      restoredRevision: options.stableRevision,
      restoredImageAndVariables: true,
      startedAt,
      restoredAt: stableRestoredAt,
      durationMs: new Date(stableRestoredAt).getTime() - rollbackStarted,
      checks: stableChecks
    },
    stagingRestoredToCandidate: {
      deploymentId: candidateRestoredDeploymentId,
      revision: options.candidateRevision,
      checks: candidateChecks
    },
    passed: true
  };
}

async function main() {
  const options = parseRailwayRollbackOptions();
  const report = await runRailwayRollbackDrill(options);
  const target = path.resolve(options.out);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) main().catch((error) => {
  console.error(`[railway-rollback-drill] ${error.message}`);
  process.exitCode = 2;
});
