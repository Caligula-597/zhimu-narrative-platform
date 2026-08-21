#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { FIXTURE } from "./fixture-constants.mjs";

function arg(argv, name, fallback) {
  const exact = argv.find((item) => item === name);
  if (exact) return "true";
  const value = argv.find((item) => item.startsWith(`${name}=`));
  return value ? value.slice(name.length + 1) : fallback;
}

function positiveNumber(raw, name, { integer = false, allowZero = false } = {}) {
  const value = Number(raw);
  const valid = Number.isFinite(value)
    && (allowZero ? value >= 0 : value > 0)
    && (!integer || Number.isInteger(value));
  if (!valid) throw new Error(`${name} must be ${allowZero ? "a non-negative" : "a positive"}${integer ? " integer" : " number"}`);
  return value;
}

function list(raw) {
  return String(raw || "").split(",").map((value) => value.trim()).filter(Boolean);
}

function percentile(sorted, value) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1)];
}

function round(value) {
  return Number(Number(value || 0).toFixed(2));
}

function deploymentRevision(raw) {
  const value = String(raw || "").trim();
  if (!/^[a-f0-9]{40}$/iu.test(value)) throw new Error("--deployment-revision must be a 40-character Git SHA");
  return value.toLowerCase();
}

export function parsePlayerHomeBenchmarkOptions(argv = process.argv.slice(2), env = process.env) {
  const baseUrl = String(arg(argv, "--url", env.API_BASE_URL || "http://127.0.0.1:4180")).replace(/\/$/, "");
  const parsedUrl = new URL(baseUrl);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error("--url must use http or https");
  if (parsedUrl.username || parsedUrl.password) throw new Error("--url must not contain credentials");
  const roomId = arg(argv, "--room-id", env.PLAYER_HOME_ROOM_ID || FIXTURE.roomId);
  const userId = arg(argv, "--user-id", env.PLAYER_HOME_USER_ID || FIXTURE.playerUserId);
  const userIds = list(arg(argv, "--user-ids", env.PLAYER_HOME_USER_IDS || userId));
  const bearerTokens = list(env.PLAYER_HOME_BEARER_TOKENS || "");
  const authMode = bearerTokens.length ? "bearer" : "demo-header";
  const allowRemoteDemoHeader = arg(argv, "--allow-demo-header", "false") === "true";
  const loopback = new Set(["127.0.0.1", "localhost", "::1"]).has(parsedUrl.hostname);
  if (authMode === "demo-header" && !loopback && !allowRemoteDemoHeader) {
    throw new Error("remote benchmarks require PLAYER_HOME_BEARER_TOKENS; use --allow-demo-header only for an isolated non-production environment");
  }
  if (authMode === "demo-header" && !userIds.length) throw new Error("at least one player user id is required");

  const evidenceMode = String(arg(argv, "--evidence-mode", "baseline")).toLowerCase();
  if (!new Set(["baseline", "staging"]).has(evidenceMode)) {
    throw new Error("--evidence-mode must be baseline or staging");
  }
  let targetEnvironment = loopback ? "local" : "unclassified";
  let targetDeploymentId = "";
  let targetDeploymentRevision = "";
  if (evidenceMode === "staging") {
    if (parsedUrl.protocol !== "https:") throw new Error("staging capacity evidence must use https");
    if (authMode !== "bearer" || bearerTokens.length < 2) {
      throw new Error("staging capacity evidence requires at least two PLAYER_HOME_BEARER_TOKENS");
    }
    targetEnvironment = String(arg(argv, "--environment", env.CAPACITY_TARGET_ENVIRONMENT || "")).toLowerCase();
    if (targetEnvironment !== "staging") throw new Error("--environment=staging is required for staging evidence");
    if (String(arg(argv, "--confirm-host", "")).toLowerCase() !== parsedUrl.hostname.toLowerCase()) {
      throw new Error(`--confirm-host must exactly match ${parsedUrl.hostname}`);
    }
    targetDeploymentId = String(arg(argv, "--deployment-id", env.CAPACITY_DEPLOYMENT_ID || "")).trim();
    if (!targetDeploymentId) throw new Error("--deployment-id is required for staging evidence");
    targetDeploymentRevision = deploymentRevision(
      arg(argv, "--deployment-revision", env.CAPACITY_DEPLOYMENT_REVISION || "")
    );
  }

  const concurrency = positiveNumber(arg(argv, "--concurrency", "20"), "--concurrency", { integer: true });
  const requests = positiveNumber(arg(argv, "--requests", "200"), "--requests", { integer: true });
  if (requests < concurrency) throw new Error("--requests must be greater than or equal to --concurrency");
  if (requests < 100) throw new Error("--requests must be at least 100 for percentile evidence");
  const warmup = positiveNumber(arg(argv, "--warmup", "10"), "--warmup", { integer: true, allowZero: true });
  const p95Limit = positiveNumber(arg(argv, "--p95-ms", env.PLAYER_HOME_P95_MS || "500"), "--p95-ms");
  const p99Limit = positiveNumber(arg(argv, "--p99-ms", env.PLAYER_HOME_P99_MS || "1000"), "--p99-ms");
  const errorRateLimit = positiveNumber(arg(argv, "--max-error-rate-pct", "0"), "--max-error-rate-pct", { allowZero: true });
  if (errorRateLimit > 100) throw new Error("--max-error-rate-pct must not exceed 100");
  const timeoutMs = positiveNumber(
    arg(argv, "--timeout-ms", String(Math.max(10_000, p99Limit * 4))),
    "--timeout-ms",
    { integer: true }
  );
  const endpoint = String(arg(argv, "--path", `/api/rooms/${roomId}/player-home`));
  if (!endpoint.startsWith("/api/")) throw new Error("--path must start with /api/");

  return {
    baseUrl,
    roomId,
    userIds,
    bearerTokens,
    authMode,
    evidenceMode,
    targetEnvironment,
    targetDeploymentId,
    targetDeploymentRevision,
    concurrency,
    requests,
    warmup,
    p95Limit,
    p99Limit,
    errorRateLimit,
    timeoutMs,
    endpoint,
    out: arg(argv, "--out", "")
  };
}

export async function runPlayerHomeBenchmark(options, fetchImpl = fetch) {
  const actors = options.authMode === "bearer" ? options.bearerTokens : options.userIds;

  async function sample(index) {
    const started = performance.now();
    try {
      const credential = actors[index % actors.length];
      const headers = options.authMode === "bearer"
        ? { authorization: `Bearer ${credential}`, accept: "application/json" }
        : { "x-user-id": credential, accept: "application/json" };
      const response = await fetchImpl(`${options.baseUrl}${options.endpoint}`, {
        headers,
        signal: AbortSignal.timeout(options.timeoutMs)
      });
      const body = await response.arrayBuffer();
      return { status: response.status, ms: performance.now() - started, bytes: body.byteLength };
    } catch (error) {
      return {
        status: 0,
        ms: performance.now() - started,
        bytes: 0,
        error: error?.name || "REQUEST_ERROR"
      };
    }
  }

  async function runBatch(total, width) {
    const results = [];
    let cursor = 0;
    async function worker() {
      while (cursor < total) {
        const index = cursor;
        cursor += 1;
        results.push(await sample(index));
      }
    }
    await Promise.all(Array.from({ length: Math.min(width, total) }, worker));
    return results;
  }

  const warmupResults = await runBatch(options.warmup, Math.min(options.concurrency, 5));
  const startedAt = new Date().toISOString();
  const wallStart = performance.now();
  const results = await runBatch(options.requests, options.concurrency);
  const wallMs = performance.now() - wallStart;
  const successful = results.filter((item) => item.status >= 200 && item.status < 300);
  const latency = successful.map((item) => item.ms).sort((a, b) => a - b);
  const observedLatency = results.map((item) => item.ms).sort((a, b) => a - b);
  const failed = results.length - successful.length;
  const errorRatePct = results.length ? (failed / results.length) * 100 : 100;
  const statusCounts = {};
  for (const result of results) {
    const key = result.status ? String(result.status) : `error:${result.error || "REQUEST_ERROR"}`;
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  }
  const totalBytes = results.reduce((sum, item) => sum + item.bytes, 0);
  const p95 = percentile(latency, 0.95);
  const p99 = percentile(latency, 0.99);
  const passed = successful.length > 0
    && errorRatePct <= options.errorRateLimit
    && p95 <= options.p95Limit
    && p99 <= options.p99Limit;

  return {
    schemaVersion: 2,
    benchmark: "player-home",
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl: options.baseUrl,
    roomId: options.roomId,
    endpoint: options.endpoint,
    authMode: options.authMode,
    productionRepresentativeAuth: options.authMode === "bearer",
    evidenceMode: options.evidenceMode || "baseline",
    capacityEvidenceReady: options.evidenceMode === "staging" && passed,
    target: {
      environment: options.targetEnvironment || "local",
      deploymentId: options.targetDeploymentId || "",
      deploymentRevision: options.targetDeploymentRevision || ""
    },
    runtime: {
      nodeVersion: process.version,
      ci: String(process.env.CI || "").toLowerCase() === "true",
      sourceRevision: process.env.GITHUB_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || ""
    },
    uniqueActors: actors.length,
    concurrency: options.concurrency,
    requests: options.requests,
    warmup: {
      requests: options.warmup,
      failed: warmupResults.filter((item) => item.status < 200 || item.status >= 300).length
    },
    successful: successful.length,
    failed,
    errorRatePct: round(errorRatePct),
    statusCounts,
    wallMs: round(wallMs),
    throughputRps: round(results.length / (wallMs / 1000)),
    successfulThroughputRps: round(successful.length / (wallMs / 1000)),
    responseBytes: {
      total: totalBytes,
      average: round(totalBytes / Math.max(results.length, 1))
    },
    latencyMs: {
      min: round(latency[0]),
      p50: round(percentile(latency, 0.5)),
      p95: round(p95),
      p99: round(p99),
      max: round(latency.at(-1))
    },
    observedRequestLatencyMs: {
      p95: round(percentile(observedLatency, 0.95)),
      p99: round(percentile(observedLatency, 0.99)),
      max: round(observedLatency.at(-1))
    },
    thresholds: {
      p95Ms: options.p95Limit,
      p99Ms: options.p99Limit,
      maxErrorRatePct: options.errorRateLimit
    },
    passed
  };
}

async function main() {
  const options = parsePlayerHomeBenchmarkOptions();
  const report = await runPlayerHomeBenchmark(options);
  console.log(JSON.stringify(report, null, 2));
  if (options.out) {
    const target = path.resolve(options.out);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const authNote = report.productionRepresentativeAuth
      ? "Bearer（生产代表性）"
      : "demo header（仅路由/数据库基线）";
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, [
      `### Player 首页性能 · ${report.endpoint}`,
      "",
      `- 认证：${authNote}`,
      `- 并发/请求：${report.concurrency} / ${report.requests}`,
      `- 成功/失败：${report.successful} / ${report.failed}（错误率 ${report.errorRatePct}%）`,
      `- P95/P99：${report.latencyMs.p95}ms / ${report.latencyMs.p99}ms`,
      `- 吞吐：${report.successfulThroughputRps} successful RPS`,
      `- 结论：${report.passed ? "通过" : "失败"}`,
      ""
    ].join("\n"), "utf8");
  }
  if (!report.passed) process.exitCode = 1;
}

const isCli = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  main().catch((error) => {
    console.error(`[player-home-benchmark] ${error.message}`);
    process.exitCode = 1;
  });
}
