import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSseCapacityOptions,
  runSseCapacityBenchmark
} from "../scripts/benchmark-sse-capacity.mjs";

const revision = "a".repeat(40);

test("SSE capacity CLI refuses production, HTTP and unconfirmed targets", () => {
  const env = { SSE_CAPACITY_BEARER_TOKENS: "token-a,token-b" };
  assert.throws(() => parseSseCapacityOptions([
    "--url=https://api.example.com",
    "--environment=production"
  ], env), /refuses production/);
  assert.throws(() => parseSseCapacityOptions([
    "--url=http://staging.example.com",
    "--environment=staging"
  ], env), /must use https/);
  assert.throws(() => parseSseCapacityOptions([
    "--url=https://staging.example.com",
    "--environment=staging",
    "--confirm-host=other.example.com"
  ], env), /must exactly match/);
});

test("SSE capacity CLI requires enough actors and immutable deployment context", () => {
  const base = [
    "--url=https://staging.example.com",
    "--environment=staging",
    "--confirm-host=staging.example.com",
    "--room-id=11111111-2222-4333-8444-555555555555",
    "--connections=3",
    "--out=report.json",
    "--deployment-id=deploy-1",
    `--deployment-revision=${revision}`
  ];
  assert.throws(
    () => parseSseCapacityOptions(base, { SSE_CAPACITY_BEARER_TOKENS: "token-a,token-b" }),
    /not enough Bearer tokens/
  );
  const parsed = parseSseCapacityOptions(
    [...base, "--max-connections-per-token=2"],
    { SSE_CAPACITY_BEARER_TOKENS: "token-a,token-b" }
  );
  assert.equal(parsed.connections, 3);
  assert.equal(parsed.deploymentRevision, revision);
  assert.equal(JSON.stringify({ ...parsed, bearerTokens: undefined }).includes("token-a"), false);
});

test("SSE capacity benchmark measures connected frames and intentional holds", async () => {
  const options = {
    baseUrl: "https://staging.example.com",
    environment: "staging",
    endpoint: "/api/rooms/room-1/events/stream",
    roomId: "room-1",
    bearerTokens: ["token-a", "token-b"],
    connections: 2,
    maxConnectionsPerToken: 1,
    holdMs: 15,
    rampMs: 0,
    handshakeP95Limit: 100,
    errorRateLimit: 0,
    earlyCloseRateLimit: 0,
    deploymentId: "deploy-1",
    deploymentRevision: revision
  };
  const seenTokens = [];
  const report = await runSseCapacityBenchmark(options, async (_url, init) => {
    seenTokens.push(init.headers.authorization);
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type":"connected"}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"type":"heartbeat"}\n\n'));
        init.signal.addEventListener("abort", () => controller.close(), { once: true });
      }
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  });

  assert.equal(report.passed, true);
  assert.equal(report.connectedConnections, 2);
  assert.equal(report.earlyCloses, 0);
  assert.equal(report.heartbeats, 2);
  assert.deepEqual(new Set(seenTokens), new Set(["Bearer token-a", "Bearer token-b"]));
  assert.equal(JSON.stringify(report).includes("token-a"), false);
});

test("SSE capacity benchmark rejects an early stream close", async () => {
  const report = await runSseCapacityBenchmark({
    baseUrl: "https://staging.example.com",
    environment: "staging",
    endpoint: "/api/rooms/room-1/events/stream",
    roomId: "room-1",
    bearerTokens: ["token-a", "token-b"],
    connections: 1,
    maxConnectionsPerToken: 1,
    holdMs: 50,
    rampMs: 0,
    handshakeP95Limit: 100,
    errorRateLimit: 0,
    earlyCloseRateLimit: 0,
    deploymentId: "deploy-1",
    deploymentRevision: revision
  }, async () => new Response('data: {"type":"connected"}\n\n', { status: 200 }));

  assert.equal(report.connectedConnections, 1);
  assert.equal(report.earlyCloses, 1);
  assert.equal(report.passed, false);
});
