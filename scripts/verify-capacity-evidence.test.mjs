import assert from "node:assert/strict";
import test from "node:test";
import { validateCapacityEvidence } from "./verify-capacity-evidence.mjs";

const revision = "a".repeat(40);

function report(benchmark, tier) {
  const common = {
    benchmark,
    passed: true,
    target: { environment: "staging", deploymentId: "dep-1", deploymentRevision: revision }
  };
  if (benchmark === "player-home") return {
    ...common,
    capacityEvidenceReady: true,
    productionRepresentativeAuth: true,
    concurrency: tier,
    requests: tier * 10
  };
  if (benchmark === "sse-idle-connection-capacity") return {
    ...common,
    environment: "staging",
    requestedConnections: tier,
    connectedConnections: tier,
    configuredHoldMs: 60_000,
    errorRatePct: 0,
    earlyCloseRatePct: 0
  };
  return {
    ...common,
    environment: "staging",
    requestedConnections: tier,
    connectedConnections: tier,
    requestedProbes: 20,
    completedProbes: 20,
    deliveryRatePct: 100,
    missingDeliveries: 0,
    triggerFailures: 0
  };
}

function validEvidence() {
  return {
    schemaVersion: 1,
    candidate: { environment: "staging", revision, deploymentId: "dep-1" },
    capacityPlan: {
      requiredConcurrentSseConnections: 100,
      requiredPlayerConcurrency: 100,
      maxCpuPercent: 80,
      maxMemoryBytes: 1_000_000_000
    },
    playerHomeReports: [20, 50, 100].map((tier) => report("player-home", tier)),
    sseIdleReports: [20, 50, 100].map((tier) => report("sse-idle-connection-capacity", tier)),
    sseFanoutReports: [20, 50, 100].map((tier) => report("sse-durable-event-fanout", tier)),
    observability: {
      samples: [0, 1, 2].map((minute) => ({
        at: `2026-08-09T01:0${minute}:00.000Z`,
        dbPoolWaiting: 0,
        dbPoolTotal: minute ? 6 : 2,
        dbPoolMax: 6,
        sseConnections: minute === 1 ? 100 : 0,
        outboxPending: minute === 1 ? 4 : 0,
        outboxDead: 0,
        outboxOldestPendingSeconds: minute === 1 ? 1 : 0,
        sseRejectedTotal: 0,
        cpuPercent: minute === 1 ? 72 : 10,
        memoryBytes: minute === 1 ? 800_000_000 : 400_000_000,
        instanceRestarts: 0
      }))
    },
    executedAt: "2026-08-09T01:03:00.000Z",
    approval: {
      executedBy: "performance-engineer",
      approvedBy: "release-owner",
      approvedAt: "2026-08-09T01:04:00.000Z"
    }
  };
}

test("commercial capacity evidence requires all three real-load dimensions and tiers", () => {
  const result = validateCapacityEvidence(validEvidence(), { now: new Date("2026-08-10T00:00:00.000Z") });
  assert.equal(result.status, "passed");
  assert.deepEqual(result.tiers, [20, 50, 100]);
  assert.equal(result.coverage.durableEventFanout, true);
});

test("capacity evidence rejects missing fan-out, pool waits, restarts and stale evidence", () => {
  const evidence = validEvidence();
  evidence.sseFanoutReports.pop();
  evidence.observability.samples[1].dbPoolWaiting = 1;
  evidence.observability.samples[2].instanceRestarts = 1;
  assert.throws(() => validateCapacityEvidence(evidence, {
    now: new Date("2026-09-10T00:00:00.000Z"),
    maxAgeDays: 7
  }), /tier 100 is missing[\s\S]*pool waiters[\s\S]*instance restarts[\s\S]*older than 7 days/u);
});

test("capacity evidence rejects secrets and deployment mismatches", () => {
  const evidence = validEvidence();
  evidence.opsToken = "forbidden";
  evidence.playerHomeReports[0].target.deploymentId = "wrong";
  assert.throws(() => validateCapacityEvidence(evidence, {
    now: new Date("2026-08-10T00:00:00.000Z")
  }), /opsToken is forbidden[\s\S]*deploymentId mismatch/u);
});
