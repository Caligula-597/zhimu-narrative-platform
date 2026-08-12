import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePlayerHomeBenchmarkOptions,
  runPlayerHomeBenchmark
} from "../scripts/benchmark-player-home.mjs";

test("benchmark CLI rejects invalid samples and remote demo identity", () => {
  assert.throws(
    () => parsePlayerHomeBenchmarkOptions(["--requests=NaN"], {}),
    /--requests must be/
  );
  assert.throws(
    () => parsePlayerHomeBenchmarkOptions(["--requests=20", "--concurrency=20"], {}),
    /at least 100/
  );
  assert.throws(
    () => parsePlayerHomeBenchmarkOptions(["--url=https://staging.example.com"], {}),
    /PLAYER_HOME_BEARER_TOKENS/
  );
  assert.throws(
    () => parsePlayerHomeBenchmarkOptions(["--url=https://user:secret@staging.example.com"], {
      PLAYER_HOME_BEARER_TOKENS: "token"
    }),
    /must not contain credentials/
  );
});

test("remote benchmark accepts bearer credentials without exposing them in options metadata", () => {
  const options = parsePlayerHomeBenchmarkOptions([
    "--url=https://staging.example.com",
    "--requests=100",
    "--concurrency=10"
  ], { PLAYER_HOME_BEARER_TOKENS: "token-a,token-b" });
  assert.equal(options.authMode, "bearer");
  assert.equal(options.bearerTokens.length, 2);
  assert.equal(options.evidenceMode, "baseline");
});

test("staging capacity evidence requires confirmed deployment identity", () => {
  const argv = [
    "--url=https://staging.example.com",
    "--requests=100",
    "--concurrency=10",
    "--evidence-mode=staging",
    "--environment=staging",
    "--confirm-host=staging.example.com",
    "--deployment-id=deploy-1",
    `--deployment-revision=${"a".repeat(40)}`
  ];
  const options = parsePlayerHomeBenchmarkOptions(argv, {
    PLAYER_HOME_BEARER_TOKENS: "token-a,token-b"
  });
  assert.equal(options.targetEnvironment, "staging");
  assert.equal(options.targetDeploymentId, "deploy-1");
  assert.throws(
    () => parsePlayerHomeBenchmarkOptions(
      argv.filter((item) => !item.startsWith("--confirm-host=")),
      { PLAYER_HOME_BEARER_TOKENS: "token-a,token-b" }
    ),
    /confirm-host/
  );
});

test("benchmark reports status, bytes, error rate and bearer-mode latency", async () => {
  const seenAuthorization = [];
  let call = 0;
  const options = {
    baseUrl: "http://127.0.0.1:4180",
    roomId: "room-1",
    endpoint: "/api/rooms/room-1/player-home",
    authMode: "bearer",
    bearerTokens: ["token-a", "token-b"],
    userIds: [],
    concurrency: 2,
    requests: 4,
    warmup: 0,
    p95Limit: 500,
    p99Limit: 1000,
    errorRateLimit: 25,
    timeoutMs: 1000
  };
  const report = await runPlayerHomeBenchmark(options, async (_url, init) => {
    seenAuthorization.push(init.headers.authorization);
    call += 1;
    return new Response(call === 4 ? "failed" : JSON.stringify({ ok: true }), {
      status: call === 4 ? 503 : 200
    });
  });

  assert.equal(report.schemaVersion, 2);
  assert.equal(report.productionRepresentativeAuth, true);
  assert.equal(report.capacityEvidenceReady, false);
  assert.equal(report.successful, 3);
  assert.equal(report.failed, 1);
  assert.equal(report.errorRatePct, 25);
  assert.deepEqual(report.statusCounts, { 200: 3, 503: 1 });
  assert.ok(report.responseBytes.total > 0);
  assert.equal(report.passed, true);
  assert.deepEqual(new Set(seenAuthorization), new Set(["Bearer token-a", "Bearer token-b"]));
  assert.equal(JSON.stringify(report).includes("token-a"), false);
});

test("network failures retain elapsed time and fail a zero-error threshold", async () => {
  const report = await runPlayerHomeBenchmark({
    baseUrl: "http://127.0.0.1:4180",
    roomId: "room-1",
    endpoint: "/api/rooms/room-1/player-home",
    authMode: "demo-header",
    bearerTokens: [],
    userIds: ["user-1"],
    concurrency: 1,
    requests: 1,
    warmup: 0,
    p95Limit: 500,
    p99Limit: 1000,
    errorRateLimit: 0,
    timeoutMs: 1000
  }, async () => { throw new TypeError("offline"); });
  assert.equal(report.failed, 1);
  assert.equal(report.statusCounts.TypeError, undefined);
  assert.equal(report.statusCounts["error:TypeError"], 1);
  assert.ok(report.observedRequestLatencyMs.max >= 0);
  assert.ok(report.wallMs >= 0);
  assert.equal(report.passed, false);
});
