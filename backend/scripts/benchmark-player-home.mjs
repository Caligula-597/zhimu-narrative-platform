#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { FIXTURE } from "./fixture-constants.mjs";

function arg(name, fallback) {
  const value = process.argv.find((item) => item.startsWith(`${name}=`));
  return value ? value.slice(name.length + 1) : fallback;
}

const baseUrl = String(arg("--url", process.env.API_BASE_URL || "http://127.0.0.1:4180")).replace(/\/$/, "");
const roomId = arg("--room-id", process.env.PLAYER_HOME_ROOM_ID || FIXTURE.roomId);
const userId = arg("--user-id", process.env.PLAYER_HOME_USER_ID || FIXTURE.playerUserId);
const userIds = String(arg("--user-ids", process.env.PLAYER_HOME_USER_IDS || userId))
  .split(",").map((value) => value.trim()).filter(Boolean);
const concurrency = Math.max(1, Number(arg("--concurrency", "20")));
const requests = Math.max(concurrency, Number(arg("--requests", "200")));
const warmup = Math.max(0, Number(arg("--warmup", "10")));
const p95Limit = Number(arg("--p95-ms", process.env.PLAYER_HOME_P95_MS || "500"));
const p99Limit = Number(arg("--p99-ms", process.env.PLAYER_HOME_P99_MS || "1000"));
const out = arg("--out", "");
const endpoint = arg("--path", `/api/rooms/${roomId}/player-home`);

function percentile(sorted, value) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1)];
}

async function sample(index) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: { "x-user-id": userIds[index % userIds.length], accept: "application/json" },
    signal: AbortSignal.timeout(Math.max(10_000, p99Limit * 4))
  });
  await response.arrayBuffer();
  return { status: response.status, ms: performance.now() - started };
}

async function runBatch(total, width) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < total) {
      cursor += 1;
      try {
        results.push(await sample(cursor - 1));
      } catch (error) {
        results.push({ status: 0, ms: 0, error: error.message });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, total) }, worker));
  return results;
}

await runBatch(warmup, Math.min(concurrency, 5));
const startedAt = new Date().toISOString();
const wallStart = performance.now();
const results = await runBatch(requests, concurrency);
const wallMs = performance.now() - wallStart;
const successful = results.filter((item) => item.status >= 200 && item.status < 300);
const latency = successful.map((item) => item.ms).sort((a, b) => a - b);
const report = {
  benchmark: "player-home",
  startedAt,
  baseUrl,
  roomId,
  uniqueUsers: userIds.length,
  endpoint,
  concurrency,
  requests,
  successful: successful.length,
  failed: results.length - successful.length,
  throughputRps: Number((successful.length / (wallMs / 1000)).toFixed(2)),
  latencyMs: {
    min: Number((latency[0] || 0).toFixed(2)),
    p50: Number(percentile(latency, 0.5).toFixed(2)),
    p95: Number(percentile(latency, 0.95).toFixed(2)),
    p99: Number(percentile(latency, 0.99).toFixed(2)),
    max: Number((latency.at(-1) || 0).toFixed(2))
  },
  thresholds: { p95Ms: p95Limit, p99Ms: p99Limit },
  passed: successful.length === requests
    && percentile(latency, 0.95) <= p95Limit
    && percentile(latency, 0.99) <= p99Limit
};

console.log(JSON.stringify(report, null, 2));
if (out) {
  const target = path.resolve(out);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
}
if (!report.passed) process.exitCode = 1;
