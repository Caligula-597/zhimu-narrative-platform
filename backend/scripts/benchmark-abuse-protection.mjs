#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { FIXTURE } from "./fixture-constants.mjs";

function arg(argv, name, fallback) {
  if (argv.includes(name)) return "true";
  const item = argv.find((value) => value.startsWith(`${name}=`));
  return item ? item.slice(name.length + 1) : fallback;
}

function positiveInteger(raw, name, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function list(raw) {
  return String(raw || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function round(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function parseAbuseBenchmarkOptions(argv = process.argv.slice(2), env = process.env) {
  const baseUrl = String(arg(argv, "--url", env.API_BASE_URL || "http://127.0.0.1:4180")).replace(/\/$/, "");
  const target = new URL(baseUrl);
  if (!["http:", "https:"].includes(target.protocol)) throw new Error("--url must use http or https");
  if (target.username || target.password) throw new Error("--url must not contain credentials");

  const loopback = new Set(["127.0.0.1", "localhost", "::1"]).has(target.hostname);
  const allowRemote = arg(argv, "--allow-remote", "false") === "true";
  const bearerTokens = list(env.ABUSE_TEST_BEARER_TOKENS);
  const demoUserIds = list(env.ABUSE_TEST_USER_IDS || FIXTURE.playerUserId);
  if (!loopback && (!allowRemote || !bearerTokens.length)) {
    throw new Error("remote abuse benchmarks require --allow-remote and ABUSE_TEST_BEARER_TOKENS");
  }
  const authMode = bearerTokens.length ? "bearer" : "demo-header";
  const actors = authMode === "bearer" ? bearerTokens : demoUserIds;
  if (!actors.length) throw new Error("at least one test actor is required");

  const requests = positiveInteger(arg(argv, "--requests", "240"), "--requests", {
    min: 40,
    max: loopback ? 10_000 : 500
  });
  const concurrency = positiveInteger(arg(argv, "--concurrency", "20"), "--concurrency", {
    min: 1,
    max: loopback ? 200 : 50
  });
  if (concurrency > requests) throw new Error("--concurrency must not exceed --requests");
  const timeoutMs = positiveInteger(arg(argv, "--timeout-ms", "5000"), "--timeout-ms", {
    min: 500,
    max: 60_000
  });
  const scope = String(arg(argv, "--scope", "room-access"));
  if (!["room-access", "voice"].includes(scope)) {
    throw new Error("--scope must be room-access or voice");
  }

  return {
    baseUrl,
    loopback,
    authMode,
    actors,
    requests,
    concurrency,
    timeoutMs,
    scope,
    out: arg(argv, "--out", "")
  };
}

export async function runAbuseBenchmark(options, fetchImpl = fetch) {
  const scope = options.scope || "room-access";
  const invalidInvite = `INVALID-${Date.now().toString(36).toUpperCase()}`;
  const invalidRoleId = "00000000-0000-4000-8000-000000000000";
  const missingRoomId = "00000000-0000-4000-8000-000000000098";
  const missingVoiceRoomId = "00000000-0000-4000-8000-000000000099";

  async function healthProbe() {
    try {
      const response = await fetchImpl(`${options.baseUrl}/api/health/live`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(options.timeoutMs)
      });
      await response.arrayBuffer();
      return response.status;
    } catch {
      return 0;
    }
  }

  async function attackSample(index) {
    const started = performance.now();
    // Voice actor buckets are intentionally exercised with one test identity;
    // network/account rotation behavior is covered by the isolated guard tests.
    const actor = scope === "voice" ? options.actors[0] : options.actors[index % options.actors.length];
    const headers = options.authMode === "bearer"
      ? { authorization: `Bearer ${actor}`, accept: "application/json" }
      : { "x-user-id": actor, accept: "application/json" };
    if (scope === "voice") {
      const lane = index % 4;
      const scenario = [
        {
          kind: "voice-message-flood",
          url: `${options.baseUrl}/api/voice-rooms/${missingVoiceRoomId}/messages`,
          body: { body: `abuse-probe-${index}` }
        },
        {
          kind: "voice-token-replay",
          url: `${options.baseUrl}/api/rooms/${missingRoomId}/voice-rooms/${missingVoiceRoomId}/token`,
          body: {}
        },
        {
          kind: "voice-room-create-flood",
          url: `${options.baseUrl}/api/rooms/${missingRoomId}/voice-rooms`,
          body: { name: `abuse-probe-${index}`, roomType: "invite_private", inviteUserIds: [] }
        },
        {
          kind: "voice-invite-flood",
          url: `${options.baseUrl}/api/voice-rooms/${missingVoiceRoomId}/members`,
          body: { inviteUserIds: [missingRoomId] }
        }
      ][lane];
      try {
        const response = await fetchImpl(scenario.url, {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify(scenario.body),
          signal: AbortSignal.timeout(options.timeoutMs)
        });
        await response.arrayBuffer();
        return { kind: scenario.kind, status: response.status, ms: performance.now() - started };
      } catch (error) {
        return {
          kind: scenario.kind,
          status: 0,
          error: error?.name || "REQUEST_ERROR",
          ms: performance.now() - started
        };
      }
    }
    const lane = index % 10;
    const kind = lane < 6 ? "invite-enumeration" : (lane < 9 ? "join-replay" : "malformed-join");
    const lookup = kind === "invite-enumeration";
    const malformed = kind === "malformed-join";
    try {
      const response = await fetchImpl(lookup
        ? `${options.baseUrl}/api/rooms/invite/${invalidInvite}-${index}`
        : `${options.baseUrl}/api/rooms/join`, {
        method: lookup ? "GET" : "POST",
        headers: lookup ? headers : { ...headers, "content-type": "application/json" },
        body: lookup ? undefined : JSON.stringify(malformed
          ? { inviteCode: "X".repeat(81), roleSlotId: "not-a-uuid", unexpected: true }
          : { inviteCode: `${invalidInvite}-${index}`, roleSlotId: invalidRoleId }),
        signal: AbortSignal.timeout(options.timeoutMs)
      });
      await response.arrayBuffer();
      return { kind, status: response.status, ms: performance.now() - started };
    } catch (error) {
      return { kind, status: 0, error: error?.name || "REQUEST_ERROR", ms: performance.now() - started };
    }
  }

  const healthBefore = await healthProbe();
  const startedAt = new Date().toISOString();
  const wallStarted = performance.now();
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < options.requests) {
      const index = cursor;
      cursor += 1;
      results.push(await attackSample(index));
    }
  }
  await Promise.all(Array.from({ length: Math.min(options.concurrency, options.requests) }, worker));
  const wallMs = performance.now() - wallStarted;
  const healthAfter = await healthProbe();

  const statusCounts = {};
  const scenarioCounts = {};
  for (const result of results) {
    const status = result.status ? String(result.status) : `error:${result.error}`;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    scenarioCounts[result.kind] ??= { requests: 0, rateLimited: 0, serverErrors: 0 };
    scenarioCounts[result.kind].requests += 1;
    if (result.status === 429) scenarioCounts[result.kind].rateLimited += 1;
    if (result.status === 0 || result.status >= 500) scenarioCounts[result.kind].serverErrors += 1;
  }
  const latency = results.map((result) => result.ms).sort((a, b) => a - b);
  const rateLimited = results.filter((result) => result.status === 429).length;
  const serverErrors = results.filter((result) => result.status === 0 || result.status >= 500).length;
  const unexpectedStatuses = results.filter((result) => {
    const allowed = scope === "voice"
      ? [403, 404, 429]
      : (result.kind === "malformed-join" ? [400, 429] : [404, 429]);
    return !allowed.includes(result.status);
  }).length;

  return {
    schemaVersion: 1,
    benchmark: `${scope}-abuse-protection`,
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl: options.baseUrl,
    loopback: options.loopback,
    authMode: options.authMode,
    uniqueActors: scope === "voice" ? 1 : options.actors.length,
    requests: options.requests,
    concurrency: options.concurrency,
    health: { before: healthBefore, after: healthAfter },
    statusCounts,
    scenarios: scenarioCounts,
    rateLimited,
    serverErrors,
    unexpectedStatuses,
    wallMs: round(wallMs),
    throughputRps: round(results.length / Math.max(wallMs / 1000, 0.001)),
    observedLatencyMs: {
      p50: round(percentile(latency, 0.5)),
      p95: round(percentile(latency, 0.95)),
      p99: round(percentile(latency, 0.99)),
      max: round(latency.at(-1))
    },
    runtime: { nodeVersion: process.version },
    passed: healthBefore === 200
      && healthAfter === 200
      && rateLimited > 0
      && Object.values(scenarioCounts).every((scenario) => scenario.rateLimited > 0)
      && serverErrors === 0
      && unexpectedStatuses === 0
  };
}

async function main() {
  const options = parseAbuseBenchmarkOptions();
  const report = await runAbuseBenchmark(options);
  console.log(JSON.stringify(report, null, 2));
  if (options.out) {
    const target = path.resolve(options.out);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (!report.passed) process.exitCode = 1;
}

const isCli = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  main().catch((error) => {
    console.error(`[abuse-benchmark] ${error.message}`);
    process.exitCode = 1;
  });
}
