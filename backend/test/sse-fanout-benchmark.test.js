import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSseFanoutOptions,
  runSseFanoutBenchmark
} from "../scripts/benchmark-sse-fanout.mjs";

const revision = "a".repeat(40);

test("fan-out parser requires staging, exact host and explicit durable-write confirmation", () => {
  const env = {
    SSE_CAPACITY_BEARER_TOKENS: "token-a,token-b",
    OPS_API_TOKEN: "0123456789abcdef"
  };
  assert.throws(() => parseSseFanoutOptions([
    "--url=https://staging.example.com",
    "--environment=production",
    "--confirm-host=staging.example.com",
    "--confirm-write-probes",
    "--room-id=room-1",
    "--deployment-id=dep-1",
    `--deployment-revision=${revision}`,
    "--out=report.json"
  ], env), /refuses production/u);
  assert.throws(() => parseSseFanoutOptions([
    "--url=https://staging.example.com",
    "--environment=staging",
    "--confirm-host=staging.example.com",
    "--room-id=room-1",
    "--deployment-id=dep-1",
    `--deployment-revision=${revision}`,
    "--out=report.json"
  ], env), /confirm-write-probes/u);
});

test("fan-out benchmark measures delivery through every connected subscriber without exposing secrets", async () => {
  const streamControllers = [];
  const encoder = new TextEncoder();
  const fetchImpl = async (url, init = {}) => {
    if ((init.method || "GET") === "POST") {
      const { probeId } = JSON.parse(init.body);
      queueMicrotask(() => {
        const frame = encoder.encode(`data: ${JSON.stringify({ type: "room.test_capacity_probe", probeId })}\n\n`);
        for (const controller of streamControllers) controller.enqueue(frame);
      });
      return new Response(JSON.stringify({ ok: true, probeId }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    const body = new ReadableStream({
      start(controller) {
        streamControllers.push(controller);
        controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));
      }
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  const options = {
    baseUrl: "https://staging.example.com",
    environment: "staging",
    roomId: "room-1",
    bearerTokens: ["bearer-secret-a", "bearer-secret-b"],
    opsToken: "ops-secret-0123456789",
    connections: 2,
    maxConnectionsPerToken: 1,
    probes: 3,
    rampMs: 0,
    connectionTimeoutMs: 1_000,
    deliveryTimeoutMs: 1_000,
    fanoutP95LimitMs: 2_000,
    minimumDeliveryRatePct: 100,
    deploymentId: "dep-1",
    deploymentRevision: revision,
    out: "unused.json"
  };
  const report = await runSseFanoutBenchmark(options, fetchImpl);
  assert.equal(report.passed, true);
  assert.equal(report.connectedConnections, 2);
  assert.equal(report.expectedDeliveries, 6);
  assert.equal(report.receivedDeliveries, 6);
  assert.equal(report.deliveryRatePct, 100);
  assert.doesNotMatch(JSON.stringify(report), /bearer-secret|ops-secret/u);
});
