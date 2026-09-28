import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  approveFactPartitionReopen,
  assertFactUnlocked,
  assertFrozenUpstreamFacts,
  assertPartitionWrite,
  createFactLock,
  createFactPartitionReopenRequest,
  validateFactMutation,
} from "../shared/immutable-stage-protocol.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockData = JSON.parse(fs.readFileSync(path.join(ROOT, "cluster-a-lock-v1.json"), "utf8"));
const results = [];
function pass(name, detail = "") { results.push({ name, status: "PASS", detail }); }
function expectError(name, expected, fn) {
  try {
    fn();
    results.push({ name, status: "FAIL", detail: `expected ${expected}` });
  } catch (error) {
    const actual = String(error?.message || error);
    results.push({ name, status: actual === expected || actual.startsWith(`${expected}:`) ? "PASS" : "FAIL", detail: actual });
  }
}

const lock = createFactLock({
  lockId: lockData.lockId,
  stageId: lockData.stageId,
  stageVersion: lockData.stageVersion,
  facts: [
    { factRef: "entity:ZHOU_MUXIAN", value: { entityId: "ZHOU_MUXIAN", name: "周慕先" }, semanticKey: "entity:ZHOU_MUXIAN:identity:all-time" },
    { factRef: "event:EVT_LU_WAN_DEATH", value: { eventId: "EVT_LU_WAN_DEATH", actorRef: "LU_WAN" }, semanticKey: "event:LU_WAN:death:1937" },
    { factRef: "claim:CLAIM_LU_WAN_ALTERED_MAPPING", value: { claimId: "CLAIM_LU_WAN_ALTERED_MAPPING", truthStatus: "FALSE" }, semanticKey: "claim:LU_WAN:altered-mapping:1937" },
  ],
  frozenByProofRefs: ["CLUSTER_A_READY"],
  frozenAt: "2026-09-14T00:00:00.000Z",
});

assert.equal(lock.status, "LOCKED");
assert.equal(lock.factRefs.length, 3);
pass("Cluster A FactLock is LOCKED", lock.aggregateHash);
assertFactUnlocked({ locks: [], factRef: "objectOwnership:bronze-mirror" });
pass("unlocked H fact can be considered for writing");
expectError("B cannot mutate locked entity", "LOCKED_FACT_MUTATION_ATTEMPT", () => assertFactUnlocked({ locks: [lock], factRef: "entity:ZHOU_MUXIAN" }));
expectError("B cannot mutate locked event", "LOCKED_FACT_MUTATION_ATTEMPT", () => assertFactUnlocked({ locks: [lock], factRef: "event:EVT_LU_WAN_DEATH" }));
expectError("B cannot mutate locked claim", "LOCKED_FACT_MUTATION_ATTEMPT", () => assertFactUnlocked({ locks: [lock], factRef: "claim:CLAIM_LU_WAN_ALTERED_MAPPING" }));
const semanticOverride = validateFactMutation({ locks: [lock], mutation: { factRef: "event:EVT_LU_WAN_DEATH_V2", semanticKey: "event:LU_WAN:death:1937", value: { eventId: "EVT_LU_WAN_DEATH_V2", actorRef: "OTHER" } } });
assert.equal(semanticOverride.accepted, false);
assert.equal(semanticOverride.code, "LOCKED_FACT_SEMANTIC_OVERRIDE");
pass("new semantic replacement for locked fact is rejected");
assertPartitionWrite({ partitionId: "HISTORICAL_OBJECT_OWNERSHIP", writerOwner: "HistoricalOwnershipAuthoring", factType: "objectOwnership", factRef: "objectOwnership:bronze-mirror", locks: [lock] });
pass("H can write unlocked ownership fact while Canon remains DRAFT");
expectError("H cannot write locked Cluster A fact", "LOCKED_FACT_MUTATION_ATTEMPT", () => assertPartitionWrite({ partitionId: "HISTORICAL_OBJECT_OWNERSHIP", writerOwner: "HistoricalOwnershipAuthoring", factType: "objectOwnership", factRef: "entity:ZHOU_MUXIAN", locks: [lock] }));
expectError("C cannot write B object state", "PARTITION_FACT_TYPE_NOT_ALLOWED", () => assertPartitionWrite({ partitionId: "CLUSTER_C", writerOwner: "MisinformationAuthoring", factType: "objectStates", factRef: "objectState:bronze-mirror:MODERN", locks: [lock] }));
const reopen = createFactPartitionReopenRequest({ lock, requestId: "cluster-a-reopen-001", failureCode: "UPSTREAM_FACT_REPAIR", reason: "explicit human review required", requestingPartition: "CLUSTER_B" });
assert.equal(reopen.autoReopen, false);
const reopened = approveFactPartitionReopen({ request: reopen, approvedBy: "human-review", replacementFacts: [{ factRef: "entity:ZHOU_MUXIAN", value: { entityId: "ZHOU_MUXIAN", name: "周慕先 v2" } }] });
assert.equal(reopened.oldLock.status, "SUPERSEDED");
assert.equal(reopened.newPartition.status, "DRAFT");
assert.equal(reopened.newPartition.parentAggregateHash, lock.aggregateHash);
pass("explicit reopen creates copy-on-write partition version and preserves old lock hash");
expectError("missing frozen upstream fact stops local authoring", "MISSING_FROZEN_UPSTREAM_FACT", () => assertFrozenUpstreamFacts({ requiredFactRefs: ["entity:ZHOU_MUXIAN", "objectOwnership:bronze-mirror"], availableFactRefs: ["entity:ZHOU_MUXIAN"] }));
assertFrozenUpstreamFacts({ requiredFactRefs: ["entity:ZHOU_MUXIAN"], availableFactRefs: ["entity:ZHOU_MUXIAN"] });
pass("available frozen upstream facts pass without authoring");

const passed = results.filter((item) => item.status === "PASS").length;
const failed = results.length - passed;
const summary = {
  protocol: "INTRA_STAGE_FACT_LOCK_V1",
  providerCalls: 0,
  tests: results.length,
  passed,
  failed,
  lockMutationTests: results.filter((item) => /locked|semantic/.test(item.name)).length,
  partitionAuthorityTests: results.filter((item) => /H can|C cannot|unlocked/.test(item.name)).length,
  reopenTests: results.filter((item) => /reopen/.test(item.name)).length,
  upstreamTests: results.filter((item) => /upstream/.test(item.name)).length,
  finalStatus: failed === 0 ? "INTRA_STAGE_FACT_LOCK_READY" : "INTRA_STAGE_FACT_LOCK_NOT_READY",
};
const report = [
  "# INTRA-STAGE FACT LOCK V1 — Test Report",
  "",
  `最终状态：**${summary.finalStatus}**`,
  "",
  `- Provider calls：${summary.providerCalls}`,
  `- Tests：${summary.tests}`,
  `- Passed：${summary.passed}`,
  `- Failed：${summary.failed}`,
  `- Cluster A lock：${lockData.lockId}`,
  `- Cluster A aggregateHash：${lockData.aggregateHash}`,
  "",
  "## Coverage",
  "",
  `- lockMutationTests：${summary.lockMutationTests}`,
  `- partitionAuthorityTests：${summary.partitionAuthorityTests}`,
  `- reopenTests：${summary.reopenTests}`,
  `- upstreamTests：${summary.upstreamTests}`,
  "",
  "## Tests",
  "",
  "| Test | Status | Detail |",
  "| --- | --- | --- |",
  ...results.map((item) => `| ${item.name} | ${item.status} | ${String(item.detail || "").replace(/\|/g, "\\|")} |`),
  "",
  "## Required behavior",
  "",
  "- Canon can remain DRAFT while Cluster A is independently LOCKED.",
  "- B cannot mutate Cluster A entity/event/claim or create semantic replacements.",
  "- H can write only unlocked historical-ownership facts.",
  "- C cannot write B object states.",
  "- Explicit Reopen is manual and copy-on-write; old lock hash remains unchanged.",
  "- Missing frozen upstream facts fail instead of triggering local authoring.",
  "",
];
fs.writeFileSync(path.join(ROOT, "intra-stage-fact-lock-test-report.md"), `${report.join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "intra-stage-fact-lock-test-results.json"), `${JSON.stringify({ summary, results }, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
if (failed) process.exitCode = 1;
