import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRailwayRollbackOptions,
  runRailwayRollbackDrill
} from "./railway-staging-rollback-drill.mjs";

const candidateRevision = "a".repeat(40);
const stableRevision = "b".repeat(40);

test("Railway rollback drill refuses production and unconfirmed environment IDs", () => {
  const env = {
    RAILWAY_ENVIRONMENT_ID: "env-staging",
    RAILWAY_SERVICE_ID: "service-1",
    RAILWAY_ACCOUNT_TOKEN: "secret",
    RAILWAY_PUBLIC_URL: "https://staging.example.com"
  };
  const base = [
    "--confirm-rollback",
    "--confirm-environment-id=env-staging",
    "--confirm-host=staging.example.com",
    "--candidate-deployment-id=candidate",
    `--candidate-revision=${candidateRevision}`,
    "--stable-deployment-id=stable",
    `--stable-revision=${stableRevision}`,
    "--out=report.json"
  ];
  assert.throws(() => parseRailwayRollbackOptions(["--environment=production", ...base], env), /production rollbacks are refused/u);
  assert.throws(() => parseRailwayRollbackOptions([
    "--environment=staging",
    ...base.map((item) => item.startsWith("--confirm-environment-id") ? "--confirm-environment-id=wrong" : item)
  ], env), /exactly match/u);
});

test("Railway rollback drill verifies exact revisions, health, then restores the candidate", async () => {
  const deployments = new Map([
    ["candidate", { id: "candidate", status: "SUCCESS", meta: { commitHash: candidateRevision } }],
    ["stable", { id: "stable", status: "REMOVED", meta: { commitHash: stableRevision } }]
  ]);
  const rollbacks = [];
  const rollbackDeploymentImpl = async (_token, deploymentId) => {
    rollbacks.push(deploymentId);
    const id = deploymentId === "stable" ? "rollback-stable" : "rollback-candidate";
    deployments.set(id, {
      id,
      status: "SUCCESS",
      meta: { commitHash: deploymentId === "stable" ? stableRevision : candidateRevision }
    });
    return { id };
  };
  const fetchImpl = async (url) => {
    if (url.endsWith("/events/stream")) {
      return new Response('data: {"type":"connected"}\n\n', {
        status: 200,
        headers: { "content-type": "text/event-stream" }
      });
    }
    const body = url.endsWith("/ready") ? { ok: true, ready: true }
      : url.endsWith("/login") ? { user: { id: "user-1" } }
        : url.includes("/worlds/") ? { id: "world-1" }
          : url.endsWith("/host/players") ? []
            : url.endsWith("/player-home") ? { room: { id: "room-1" } }
              : { ok: true };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  const report = await runRailwayRollbackDrill({
    environment: "staging",
    environmentId: "env-staging",
    serviceId: "service-1",
    token: "secret",
    baseUrl: "https://staging.example.com",
    candidateDeploymentId: "candidate",
    candidateRevision,
    stableDeploymentId: "stable",
    stableRevision,
    health: {
      loginEmail: "recovery@example.test",
      loginPassword: "password",
      creatorToken: "creator-token",
      playerToken: "player-token",
      hostToken: "host-token",
      worldId: "world-1",
      roomId: "room-1"
    },
    timeoutMs: 100,
    pollMs: 0
  }, {
    rollbackDeploymentImpl,
    fetchDeploymentImpl: async (_token, id) => deployments.get(id),
    fetchImpl,
    waitImpl: async () => {}
  });
  assert.equal(report.passed, true);
  assert.deepEqual(rollbacks, ["stable", "candidate"]);
  assert.equal(report.rollback.restoredImageAndVariables, true);
  assert.equal(report.rollback.checks.every((check) => check.passed), true);
  assert.deepEqual(report.rollback.checks.map((check) => check.id), [
    "live", "ready", "login", "creator-read", "player-home", "host-console", "sse"
  ]);
  assert.equal(report.stagingRestoredToCandidate.revision, candidateRevision);
});
