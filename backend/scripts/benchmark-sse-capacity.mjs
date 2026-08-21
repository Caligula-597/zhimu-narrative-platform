#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

function arg(argv, name, fallback = "") {
  const exact = argv.find((item) => item === name);
  if (exact) return "true";
  const value = argv.find((item) => item.startsWith(`${name}=`));
  return value ? value.slice(name.length + 1) : fallback;
}

function list(raw) {
  return String(raw || "").split(",").map((value) => value.trim()).filter(Boolean);
}

function boundedNumber(raw, name, { minimum, maximum, integer = false } = {}) {
  const value = Number(raw);
  if (!Number.isFinite(value)
    || (integer && !Number.isInteger(value))
    || value < minimum
    || value > maximum) {
    throw new Error(`${name} must be ${integer ? "an integer" : "a number"} between ${minimum} and ${maximum}`);
  }
  return value;
}

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}

function round(value) {
  return Number(Number(value || 0).toFixed(2));
}

function shaRevision(raw) {
  const value = String(raw || "").trim();
  if (!/^[a-f0-9]{40}$/iu.test(value)) throw new Error("--deployment-revision must be a 40-character Git SHA");
  return value.toLowerCase();
}

export function parseSseCapacityOptions(argv = process.argv.slice(2), env = process.env) {
  const baseUrl = String(arg(argv, "--url", env.API_BASE_URL || "")).replace(/\/$/u, "");
  if (!baseUrl) throw new Error("--url is required");
  const parsedUrl = new URL(baseUrl);
  if (parsedUrl.protocol !== "https:") throw new Error("remote SSE capacity targets must use https");
  if (parsedUrl.username || parsedUrl.password) throw new Error("--url must not contain credentials");

  const environment = String(arg(argv, "--environment", env.CAPACITY_TARGET_ENVIRONMENT || "")).toLowerCase();
  if (environment !== "staging") throw new Error("--environment=staging is required; this tool refuses production targets");
  const confirmedHost = String(arg(argv, "--confirm-host", "")).toLowerCase();
  if (confirmedHost !== parsedUrl.hostname.toLowerCase()) {
    throw new Error(`--confirm-host must exactly match ${parsedUrl.hostname}`);
  }

  const bearerTokens = list(env.SSE_CAPACITY_BEARER_TOKENS || "");
  if (bearerTokens.length < 2) throw new Error("SSE_CAPACITY_BEARER_TOKENS must contain at least two staging Bearer tokens");
  const connections = boundedNumber(arg(argv, "--connections", "20"), "--connections", {
    minimum: 1,
    maximum: 2_000,
    integer: true
  });
  const maxConnectionsPerToken = boundedNumber(
    arg(argv, "--max-connections-per-token", "1"),
    "--max-connections-per-token",
    { minimum: 1, maximum: 8, integer: true }
  );
  if (connections > bearerTokens.length * maxConnectionsPerToken) {
    throw new Error("not enough Bearer tokens for the requested connections and --max-connections-per-token");
  }

  const roomId = String(arg(argv, "--room-id", env.SSE_CAPACITY_ROOM_ID || "")).trim();
  const endpoint = String(arg(argv, "--path", roomId ? `/api/rooms/${roomId}/events/stream` : ""));
  if (!endpoint.startsWith("/api/") || !endpoint.endsWith("/events/stream")) {
    throw new Error("--path must be an /api/.../events/stream endpoint or provide --room-id");
  }

  const holdMs = boundedNumber(arg(argv, "--hold-ms", "60000"), "--hold-ms", {
    minimum: 30_000,
    maximum: 600_000,
    integer: true
  });
  const rampMs = boundedNumber(arg(argv, "--ramp-ms", "10000"), "--ramp-ms", {
    minimum: 0,
    maximum: 300_000,
    integer: true
  });
  const handshakeP95Limit = boundedNumber(
    arg(argv, "--max-handshake-p95-ms", "2000"),
    "--max-handshake-p95-ms",
    { minimum: 1, maximum: 60_000 }
  );
  const errorRateLimit = boundedNumber(
    arg(argv, "--max-error-rate-pct", "0"),
    "--max-error-rate-pct",
    { minimum: 0, maximum: 100 }
  );
  const earlyCloseRateLimit = boundedNumber(
    arg(argv, "--max-early-close-rate-pct", "0"),
    "--max-early-close-rate-pct",
    { minimum: 0, maximum: 100 }
  );
  const out = String(arg(argv, "--out", "")).trim();
  if (!out) throw new Error("--out is required for capacity evidence");

  return {
    baseUrl,
    environment,
    confirmedHost,
    endpoint,
    roomId,
    bearerTokens,
    connections,
    maxConnectionsPerToken,
    holdMs,
    rampMs,
    handshakeP95Limit,
    errorRateLimit,
    earlyCloseRateLimit,
    deploymentId: String(arg(argv, "--deployment-id", env.CAPACITY_DEPLOYMENT_ID || "")).trim() || (() => {
      throw new Error("--deployment-id is required");
    })(),
    deploymentRevision: shaRevision(arg(argv, "--deployment-revision", env.CAPACITY_DEPLOYMENT_REVISION || "")),
    out
  };
}

function parseSseFrames(state, chunk, onData) {
  state.buffer = `${state.buffer}${chunk}`.replace(/\r\n/gu, "\n");
  let boundary = state.buffer.indexOf("\n\n");
  while (boundary >= 0) {
    const frame = state.buffer.slice(0, boundary);
    state.buffer = state.buffer.slice(boundary + 2);
    const data = frame.split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (data) onData(data);
    boundary = state.buffer.indexOf("\n\n");
  }
}

async function wait(delayMs) {
  if (delayMs <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function openSseConnection({ options, index, fetchImpl }) {
  const controller = new AbortController();
  const started = performance.now();
  let intentionalAbort = false;
  const timer = setTimeout(() => {
    intentionalAbort = true;
    controller.abort();
  }, options.holdMs);
  timer.unref?.();

  const result = {
    index,
    status: 0,
    headerMs: 0,
    connectedMs: 0,
    events: 0,
    heartbeats: 0,
    bytes: 0,
    connected: false,
    earlyClose: false,
    heldForMs: 0,
    error: ""
  };

  try {
    const token = options.bearerTokens[index % options.bearerTokens.length];
    const response = await fetchImpl(`${options.baseUrl}${options.endpoint}`, {
      headers: { authorization: `Bearer ${token}`, accept: "text/event-stream" },
      cache: "no-store",
      signal: controller.signal
    });
    result.status = response.status;
    result.headerMs = round(performance.now() - started);
    if (!response.ok || !response.body) {
      await response.body?.cancel?.().catch(() => {});
      result.error = `HTTP_${response.status}`;
      return result;
    }

    const decoder = new TextDecoder();
    const parserState = { buffer: "" };
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result.bytes += value.byteLength;
      parseSseFrames(parserState, decoder.decode(value, { stream: true }), (data) => {
        result.events += 1;
        try {
          const payload = JSON.parse(data);
          if (payload?.type === "connected" && !result.connected) {
            result.connected = true;
            result.connectedMs = round(performance.now() - started);
          }
          if (payload?.type === "heartbeat") result.heartbeats += 1;
        } catch {
          // Non-JSON application events still count as delivered SSE frames.
        }
      });
    }
    if (!intentionalAbort) result.earlyClose = true;
  } catch (error) {
    if (!(intentionalAbort && controller.signal.aborted)) result.error = error?.name || "SSE_CONNECTION_ERROR";
  } finally {
    clearTimeout(timer);
    result.heldForMs = round(performance.now() - started);
  }
  return result;
}

export async function runSseCapacityBenchmark(options, fetchImpl = fetch) {
  const startedAt = new Date().toISOString();
  const wallStart = performance.now();
  const spacingMs = options.connections > 1 ? options.rampMs / (options.connections - 1) : 0;
  const connections = await Promise.all(Array.from({ length: options.connections }, async (_, index) => {
    await wait(index * spacingMs);
    return openSseConnection({ options, index, fetchImpl });
  }));
  const wallMs = performance.now() - wallStart;
  const connected = connections.filter((item) => item.connected);
  const errors = connections.filter((item) => item.error || !item.connected);
  const earlyCloses = connections.filter((item) => item.earlyClose);
  const handshakeLatencies = connected.map((item) => item.connectedMs).sort((a, b) => a - b);
  const errorRatePct = (errors.length / options.connections) * 100;
  const earlyCloseRatePct = (earlyCloses.length / options.connections) * 100;
  const statusCounts = {};
  const errorCounts = {};
  for (const item of connections) {
    const status = String(item.status || 0);
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    if (item.error) errorCounts[item.error] = (errorCounts[item.error] || 0) + 1;
  }
  const handshakeP95 = percentile(handshakeLatencies, 0.95);

  return {
    schemaVersion: 1,
    benchmark: "sse-idle-connection-capacity",
    environment: options.environment,
    startedAt,
    finishedAt: new Date().toISOString(),
    target: {
      baseUrl: options.baseUrl,
      endpoint: options.endpoint,
      deploymentId: options.deploymentId,
      deploymentRevision: options.deploymentRevision
    },
    auth: {
      mode: "bearer",
      productionRepresentative: true,
      uniqueActors: options.bearerTokens.length,
      maxConnectionsPerActor: options.maxConnectionsPerToken
    },
    requestedConnections: options.connections,
    connectedConnections: connected.length,
    failedConnections: errors.length,
    earlyCloses: earlyCloses.length,
    errorRatePct: round(errorRatePct),
    earlyCloseRatePct: round(earlyCloseRatePct),
    statusCounts,
    errorCounts,
    wallMs: round(wallMs),
    configuredHoldMs: options.holdMs,
    configuredRampMs: options.rampMs,
    deliveredFrames: connections.reduce((sum, item) => sum + item.events, 0),
    heartbeats: connections.reduce((sum, item) => sum + item.heartbeats, 0),
    receivedBytes: connections.reduce((sum, item) => sum + item.bytes, 0),
    handshakeMs: {
      p50: round(percentile(handshakeLatencies, 0.5)),
      p95: round(handshakeP95),
      p99: round(percentile(handshakeLatencies, 0.99)),
      max: round(handshakeLatencies.at(-1))
    },
    thresholds: {
      maxHandshakeP95Ms: options.handshakeP95Limit,
      maxErrorRatePct: options.errorRateLimit,
      maxEarlyCloseRatePct: options.earlyCloseRateLimit
    },
    scopeLimitations: [
      "Measures authenticated idle SSE connection admission, hold stability and heartbeat delivery.",
      "Does not measure application event fan-out throughput or database write pressure."
    ],
    passed: connected.length > 0
      && handshakeP95 <= options.handshakeP95Limit
      && errorRatePct <= options.errorRateLimit
      && earlyCloseRatePct <= options.earlyCloseRateLimit
  };
}

async function main() {
  const options = parseSseCapacityOptions();
  const report = await runSseCapacityBenchmark(options);
  const target = path.resolve(options.out);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

const isCli = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  main().catch((error) => {
    console.error(`[sse-capacity] ${error.message}`);
    process.exitCode = 2;
  });
}
