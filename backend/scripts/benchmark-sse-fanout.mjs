#!/usr/bin/env node
import { randomUUID } from "node:crypto";
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

function boundedNumber(raw, name, { minimum, maximum, integer = false }) {
  const value = Number(raw);
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value)) || value < minimum || value > maximum) {
    throw new Error(`${name} must be ${integer ? "an integer" : "a number"} between ${minimum} and ${maximum}`);
  }
  return value;
}

function shaRevision(raw) {
  const value = String(raw || "").trim();
  if (!/^[a-f0-9]{40}$/iu.test(value)) throw new Error("--deployment-revision must be a 40-character Git SHA");
  return value.toLowerCase();
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}

function round(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function parseSseFanoutOptions(argv = process.argv.slice(2), env = process.env) {
  const baseUrl = String(arg(argv, "--url", env.API_BASE_URL || "")).replace(/\/$/u, "");
  if (!baseUrl) throw new Error("--url is required");
  const parsedUrl = new URL(baseUrl);
  if (parsedUrl.protocol !== "https:") throw new Error("remote SSE fan-out targets must use https");
  if (parsedUrl.username || parsedUrl.password) throw new Error("--url must not contain credentials");
  if (String(arg(argv, "--environment", env.CAPACITY_TARGET_ENVIRONMENT || "")).toLowerCase() !== "staging") {
    throw new Error("--environment=staging is required; this tool refuses production targets");
  }
  if (String(arg(argv, "--confirm-host", "")).toLowerCase() !== parsedUrl.hostname.toLowerCase()) {
    throw new Error(`--confirm-host must exactly match ${parsedUrl.hostname}`);
  }
  if (arg(argv, "--confirm-write-probes", "false") !== "true") {
    throw new Error("--confirm-write-probes is required because each probe writes a durable staging event");
  }

  const roomId = String(arg(argv, "--room-id", env.SSE_CAPACITY_ROOM_ID || "")).trim();
  if (!roomId) throw new Error("--room-id is required");
  const bearerTokens = list(env.SSE_CAPACITY_BEARER_TOKENS || "");
  if (bearerTokens.length < 2) throw new Error("SSE_CAPACITY_BEARER_TOKENS must contain at least two staging Bearer tokens");
  const opsToken = String(env.OPS_API_TOKEN || "").trim();
  if (opsToken.length < 16) throw new Error("OPS_API_TOKEN must be a staging secret of at least 16 characters");
  const connections = boundedNumber(arg(argv, "--connections", "20"), "--connections", {
    minimum: 1, maximum: 2_000, integer: true
  });
  const maxConnectionsPerToken = boundedNumber(
    arg(argv, "--max-connections-per-token", "1"),
    "--max-connections-per-token",
    { minimum: 1, maximum: 8, integer: true }
  );
  if (connections > bearerTokens.length * maxConnectionsPerToken) {
    throw new Error("not enough Bearer tokens for the requested connections and --max-connections-per-token");
  }
  const out = String(arg(argv, "--out", "")).trim();
  if (!out) throw new Error("--out is required for capacity evidence");

  return {
    baseUrl,
    environment: "staging",
    roomId,
    bearerTokens,
    opsToken,
    connections,
    maxConnectionsPerToken,
    probes: boundedNumber(arg(argv, "--probes", "20"), "--probes", { minimum: 1, maximum: 100, integer: true }),
    rampMs: boundedNumber(arg(argv, "--ramp-ms", "10000"), "--ramp-ms", { minimum: 0, maximum: 300_000, integer: true }),
    connectionTimeoutMs: boundedNumber(arg(argv, "--connection-timeout-ms", "15000"), "--connection-timeout-ms", {
      minimum: 1_000, maximum: 120_000, integer: true
    }),
    deliveryTimeoutMs: boundedNumber(arg(argv, "--delivery-timeout-ms", "10000"), "--delivery-timeout-ms", {
      minimum: 1_000, maximum: 120_000, integer: true
    }),
    fanoutP95LimitMs: boundedNumber(arg(argv, "--max-fanout-p95-ms", "2000"), "--max-fanout-p95-ms", {
      minimum: 1, maximum: 60_000, integer: true
    }),
    minimumDeliveryRatePct: boundedNumber(arg(argv, "--min-delivery-rate-pct", "100"), "--min-delivery-rate-pct", {
      minimum: 0, maximum: 100
    }),
    deploymentId: String(arg(argv, "--deployment-id", env.CAPACITY_DEPLOYMENT_ID || "")).trim() || (() => {
      throw new Error("--deployment-id is required");
    })(),
    deploymentRevision: shaRevision(arg(argv, "--deployment-revision", env.CAPACITY_DEPLOYMENT_REVISION || "")),
    out
  };
}

function parseFrames(state, chunk, onData) {
  state.buffer = `${state.buffer}${chunk}`.replace(/\r\n/gu, "\n");
  let boundary = state.buffer.indexOf("\n\n");
  while (boundary >= 0) {
    const frame = state.buffer.slice(0, boundary);
    state.buffer = state.buffer.slice(boundary + 2);
    const data = frame.split("\n").filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart()).join("\n");
    if (data) onData(data);
    boundary = state.buffer.indexOf("\n\n");
  }
}

function createSubscriber({ options, index, fetchImpl, onProbe }) {
  const controller = new AbortController();
  let reader;
  let intentionalStop = false;
  let readySettled = false;
  let settleReady;
  const state = { index, status: 0, connected: false, connectedMs: 0, error: "", unexpectedClose: false };
  const ready = new Promise((resolve) => { settleReady = resolve; });
  const started = performance.now();
  const connectionTimer = setTimeout(() => {
    if (!state.connected) controller.abort(new Error("SSE connection timeout"));
  }, options.connectionTimeoutMs);

  function finishReady(value) {
    if (readySettled) return;
    readySettled = true;
    clearTimeout(connectionTimer);
    settleReady(value);
  }

  const done = (async () => {
    try {
      const token = options.bearerTokens[index % options.bearerTokens.length];
      const response = await fetchImpl(`${options.baseUrl}/api/rooms/${encodeURIComponent(options.roomId)}/events/stream`, {
        headers: { authorization: `Bearer ${token}`, accept: "text/event-stream" },
        cache: "no-store",
        signal: controller.signal
      });
      state.status = response.status;
      if (!response.ok || !response.body) {
        state.error = `HTTP_${response.status}`;
        finishReady(false);
        return;
      }
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parserState = { buffer: "" };
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        parseFrames(parserState, decoder.decode(value, { stream: true }), (raw) => {
          try {
            const payload = JSON.parse(raw);
            if (payload?.type === "connected" && !state.connected) {
              state.connected = true;
              state.connectedMs = round(performance.now() - started);
              finishReady(true);
            }
            if (payload?.type === "room.test_capacity_probe" && payload.probeId) {
              onProbe(index, payload.probeId, performance.now());
            }
          } catch {
            // Malformed frames are ignored but will surface as missing deliveries.
          }
        });
      }
      if (!intentionalStop) state.unexpectedClose = true;
    } catch (error) {
      if (!intentionalStop) state.error = error?.name || "SSE_CONNECTION_ERROR";
    } finally {
      finishReady(false);
    }
  })();

  return {
    state,
    ready,
    done,
    stop() {
      intentionalStop = true;
      controller.abort();
      reader?.cancel().catch(() => {});
    }
  };
}

function wait(delayMs) {
  return delayMs <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function runSseFanoutBenchmark(options, fetchImpl = fetch) {
  const startedAt = new Date().toISOString();
  const deliveries = new Map();
  const allDeliveryLatencies = [];
  const spacingMs = options.connections > 1 ? options.rampMs / (options.connections - 1) : 0;
  const subscribers = [];
  for (let index = 0; index < options.connections; index += 1) {
    if (index > 0) await wait(spacingMs);
    subscribers.push(createSubscriber({
      options,
      index,
      fetchImpl,
      onProbe(subscriberIndex, probeId, receivedAt) {
        const probe = deliveries.get(probeId);
        if (!probe || probe.received.has(subscriberIndex)) return;
        probe.received.add(subscriberIndex);
        const latencyMs = round(receivedAt - probe.sentAt);
        probe.latenciesMs.push(latencyMs);
        allDeliveryLatencies.push(latencyMs);
        if (probe.received.size === probe.expected) probe.resolve?.();
      }
    }));
  }

  const readyResults = await Promise.all(subscribers.map((subscriber) => subscriber.ready));
  const connected = readyResults.filter(Boolean).length;
  const probeReports = [];

  if (connected === options.connections) {
    for (let index = 0; index < options.probes; index += 1) {
      const probeId = `capacity-${Date.now()}-${index}-${randomUUID()}`;
      let resolveDelivery;
      const delivered = new Promise((resolve) => { resolveDelivery = resolve; });
      const probe = {
        probeId,
        sentAt: performance.now(),
        expected: connected,
        received: new Set(),
        latenciesMs: [],
        resolve: resolveDelivery
      };
      deliveries.set(probeId, probe);
      let status = 0;
      let triggerMs = 0;
      let triggerError = "";
      try {
        const triggerStarted = performance.now();
        const response = await fetchImpl(
          `${options.baseUrl}/api/ops/capacity/rooms/${encodeURIComponent(options.roomId)}/events`,
          {
            method: "POST",
            headers: { "x-ops-token": options.opsToken, "content-type": "application/json" },
            body: JSON.stringify({ probeId })
          }
        );
        status = response.status;
        triggerMs = round(performance.now() - triggerStarted);
        if (!response.ok) triggerError = `HTTP_${response.status}`;
        await response.body?.cancel?.().catch(() => {});
      } catch (error) {
        triggerError = error?.name || "PROBE_TRIGGER_ERROR";
      }
      if (!triggerError) {
        await Promise.race([
          delivered,
          new Promise((resolve) => setTimeout(resolve, options.deliveryTimeoutMs))
        ]);
      }
      probeReports.push({
        probeId,
        triggerStatus: status,
        triggerMs,
        triggerError,
        expectedDeliveries: connected,
        receivedDeliveries: probe.received.size,
        missingDeliveries: connected - probe.received.size,
        fanoutMs: {
          p50: round(percentile(probe.latenciesMs, 0.5)),
          p95: round(percentile(probe.latenciesMs, 0.95)),
          p99: round(percentile(probe.latenciesMs, 0.99)),
          max: round(Math.max(0, ...probe.latenciesMs))
        }
      });
      deliveries.delete(probeId);
    }
  }

  for (const subscriber of subscribers) subscriber.stop();
  await Promise.allSettled(subscribers.map((subscriber) => subscriber.done));

  const expectedDeliveries = probeReports.reduce((sum, probe) => sum + probe.expectedDeliveries, 0);
  const receivedDeliveries = probeReports.reduce((sum, probe) => sum + probe.receivedDeliveries, 0);
  const deliveryRatePct = expectedDeliveries ? (receivedDeliveries / expectedDeliveries) * 100 : 0;
  const fanoutP95Ms = round(percentile(allDeliveryLatencies, 0.95));
  const triggerFailures = probeReports.filter((probe) => probe.triggerError).length;

  return {
    schemaVersion: 1,
    benchmark: "sse-durable-event-fanout",
    environment: options.environment,
    startedAt,
    finishedAt: new Date().toISOString(),
    target: {
      baseUrl: options.baseUrl,
      roomId: options.roomId,
      deploymentId: options.deploymentId,
      deploymentRevision: options.deploymentRevision
    },
    auth: {
      subscriberMode: "bearer",
      opsTriggerMode: "x-ops-token",
      productionRepresentative: true,
      uniqueActors: options.bearerTokens.length,
      maxConnectionsPerActor: options.maxConnectionsPerToken
    },
    requestedConnections: options.connections,
    connectedConnections: connected,
    subscriberFailures: subscribers.filter((subscriber) => subscriber.state.error || !subscriber.state.connected)
      .map((subscriber) => ({ index: subscriber.state.index, status: subscriber.state.status, error: subscriber.state.error })),
    requestedProbes: options.probes,
    completedProbes: probeReports.length,
    triggerFailures,
    expectedDeliveries,
    receivedDeliveries,
    missingDeliveries: expectedDeliveries - receivedDeliveries,
    deliveryRatePct: round(deliveryRatePct),
    fanoutMs: {
      p50: round(percentile(allDeliveryLatencies, 0.5)),
      p95: fanoutP95Ms,
      p99: round(percentile(allDeliveryLatencies, 0.99)),
      max: round(Math.max(0, ...allDeliveryLatencies))
    },
    probes: probeReports,
    thresholds: {
      maxFanoutP95Ms: options.fanoutP95LimitMs,
      minDeliveryRatePct: options.minimumDeliveryRatePct
    },
    dataPath: ["PostgreSQL transaction", "event_outbox", "room_event_journal", "room event bus", "authenticated SSE"],
    passed: connected === options.connections
      && probeReports.length === options.probes
      && triggerFailures === 0
      && deliveryRatePct >= options.minimumDeliveryRatePct
      && fanoutP95Ms <= options.fanoutP95LimitMs
  };
}

async function main() {
  const options = parseSseFanoutOptions();
  const report = await runSseFanoutBenchmark(options);
  const target = path.resolve(options.out);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  main().catch((error) => {
    console.error(`[sse-fanout] ${error.message}`);
    process.exitCode = 2;
  });
}
