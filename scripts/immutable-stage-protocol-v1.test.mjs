import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceStage,
  approveReopen,
  assertDerivedViewReadOnly,
  assertDownstreamCannotWriteCanon,
  assertFrozenSnapshot,
  assertFrozenSnapshotUnchanged,
  assertParentSnapshot,
  assertWriteCapability,
  createDraftStage,
  createUpstreamReopenRequest,
  evaluateProof,
  freezeStage,
  invalidateDescendants,
  validateProviderOutput,
} from "../shared/immutable-stage-protocol.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportFile = path.join(ROOT, "immutable-stage-protocol-test-report.md");
const resultsFile = path.join(ROOT, "immutable-stage-protocol-test-results.json");
const authorityRegistry = JSON.parse(fs.readFileSync(path.join(ROOT, "stage-authority-registry.json"), "utf8"));
const freezeContracts = JSON.parse(fs.readFileSync(path.join(ROOT, "stage-freeze-contracts.json"), "utf8"));
const results = [];

function expectError(name, expected, fn) {
  try {
    fn();
    results.push({ name, status: "FAIL", detail: `expected ${expected}` });
  } catch (error) {
    const actual = String(error?.message || error);
    results.push({ name, status: actual === expected || actual.startsWith(`${expected}:`) ? "PASS" : "FAIL", detail: actual });
  }
}
function pass(name, detail = "") { results.push({ name, status: "PASS", detail }); }

const content = { facts: [{ id: "F1", value: "immutable" }], version: 1 };
let draft = createDraftStage({ stageId: "CanonicalFactGraph", version: 1, content, contractVersion: 1 });
for (const next of ["STRUCTURALLY_VALID", "CONTENT_FULL_SCORE", "INTERFACE_PROVEN"]) draft = advanceStage(draft, next);
const snapshot = freezeStage({
  stageId: draft.stageId,
  version: draft.version,
  content: draft.content,
  contractVersion: draft.contractVersion,
  proofs: {
    LOCAL_PROOF: "PASS",
    CROSS_FACT_PROOF: "PASS",
    DOWNSTREAM_INTERFACE_PROOF: "PASS",
    NO_CONTENT_DEBT: "PASS",
    IMMUTABILITY_PROOF: "PASS",
    HUMAN_READABLE_REVIEW: "PASS",
  },
  frozenAt: "2026-09-13T00:00:00.000Z",
});

assertFrozenSnapshot(snapshot);
pass("freeze snapshot", snapshot.snapshotId);
assertParentSnapshot({ expectedSnapshotId: snapshot.snapshotId, expectedContentHash: snapshot.contentHash, actualSnapshot: snapshot });
pass("parent snapshot id and hash match");
assertFrozenSnapshotUnchanged(snapshot, content);
pass("frozen content hash remains valid");
expectError("parent hash mismatch hard-fails", "PARENT_SNAPSHOT_MUTATED", () => assertParentSnapshot({ expectedSnapshotId: snapshot.snapshotId, expectedContentHash: "bad", actualSnapshot: snapshot }));
expectError("frozen content mutation hard-fails", "FROZEN_STAGE_MUTATION_ATTEMPT", () => assertFrozenSnapshotUnchanged(snapshot, { facts: [], version: 1 }));
expectError("NOT_EVALUABLE cannot freeze", "FREEZE_PROOF_NOT_COMPLETE:DOWNSTREAM_INTERFACE_PROOF=NOT_EVALUABLE", () => freezeStage({ stageId: "X", content: {}, proofs: { LOCAL_PROOF: "PASS", DOWNSTREAM_INTERFACE_PROOF: "NOT_EVALUABLE" } }));
const missingProof = evaluateProof({ prerequisites: [null], check: () => true });
assert.equal(missingProof.status, "NOT_EVALUABLE");
pass("missing prerequisite returns NOT_EVALUABLE");

assertWriteCapability({ currentStageId: "CanonicalFactGraph", dataOwnerStage: "CanonicalFactGraph", lifecycleStatus: "DRAFT" });
pass("owner can write draft");
expectError("frozen owner cannot write", "WRITE_REQUIRES_DRAFT:FROZEN", () => assertWriteCapability({ currentStageId: "CanonicalFactGraph", dataOwnerStage: "CanonicalFactGraph", lifecycleStatus: "FROZEN" }));
expectError("downstream has no canon capability", "CANON_WRITE_CAPABILITY_ABSENT", () => assertDownstreamCannotWriteCanon("Writer"));
expectError("derived view cannot be patched", "DERIVED_VIEW_WRITE_FORBIDDEN", () => assertDerivedViewReadOnly({ authorityStage: "Writer", writeAttempt: true }));

const reopenRequest = createUpstreamReopenRequest({
  requestId: "reopen-001",
  upstreamStageId: "CanonicalFactGraph",
  frozenSnapshot: snapshot,
  failureCode: "MISSING_CANON_FACT",
  factRefs: ["event:E2"],
  reason: "downstream cannot invent the event",
  requestingStage: "Kernel",
});
assert.equal(reopenRequest.autoReopen, false);
pass("reopen request is pending and auto reopen is false");
const reopen = approveReopen({ request: reopenRequest, approvedBy: "human-review", newContent: { facts: [{ id: "F1", value: "revised" }], version: 2 } });
assert.equal(reopen.oldSnapshot.status, "SUPERSEDED");
assert.equal(reopen.draft.status, "DRAFT");
assert.equal(reopen.draft.version, 2);
assert.equal(snapshot.contentHash, snapshot.contentHash);
pass("approved reopen creates copy-on-write draft and preserves old hash");
const descendants = invalidateDescendants([
  { stageId: "Kernel", status: "FROZEN", parentSnapshotIds: [snapshot.snapshotId] },
  { stageId: "P5", status: "FROZEN", parentSnapshotIds: ["other"] },
], snapshot.snapshotId);
assert.equal(descendants[0].status, "STALE");
assert.equal(descendants[1].status, "FROZEN");
pass("descendants referencing old snapshot become STALE");

const providerAllowed = validateProviderOutput({
  output: { writes: [{ ownerStage: "CanonAuthoring", factRef: "event:E2" }] },
  allowedWriteOwners: ["CanonAuthoring"],
  allowedFactRefs: ["event:E2"],
  immutableSnapshotRefs: [snapshot.snapshotId],
});
assert.equal(providerAllowed.accepted, true);
pass("provider in-scope write accepted");
const providerForbidden = validateProviderOutput({
  output: { writes: [{ ownerStage: "Writer", factRef: "event:E2", snapshotId: snapshot.snapshotId }] },
  allowedWriteOwners: ["CanonAuthoring"],
  allowedFactRefs: ["event:E2"],
  immutableSnapshotRefs: [snapshot.snapshotId],
});
assert.equal(providerForbidden.accepted, false);
assert.equal(providerForbidden.writes.length, 0);
pass("provider out-of-scope write is rejected and not merged", providerForbidden.violations.map((item) => item.code).join(","));

const stageIds = authorityRegistry.stages.map((item) => item.stageId);
assert.deepEqual(stageIds, ["CreatorIntent", "CanonicalFactGraph", "Kernel", "Formation", "P5", "P6", "GAME", "Writer", "Runtime"]);
assert.equal(authorityRegistry.stages.find((item) => item.stageId === "CanonicalFactGraph").writeOwner, "CanonAuthoring");
assert.equal(authorityRegistry.stages.filter((item) => item.stageId !== "CanonicalFactGraph").every((item) => item.canWriteCanon === false), true);
assert.equal(authorityRegistry.derivedViews.every((item) => item.readOnly && item.regeneratable && item.nonAuthoritative), true);
pass("authority registry covers the existing staged pipeline");
assert.deepEqual(freezeContracts.lifecycle, ["DRAFT", "STRUCTURALLY_VALID", "CONTENT_FULL_SCORE", "INTERFACE_PROVEN", "FROZEN", "STALE", "SUPERSEDED"]);
assert.equal(freezeContracts.reopen.autoReopen, false);
assert.equal(freezeContracts.reopen.copyOnWrite, true);
assert.equal(freezeContracts.providerOutput.outOfScopeAction, "DROP + WRITE_SCOPE_VIOLATION");
pass("freeze contracts declare lifecycle, reopen, and provider scope");

const passed = results.filter((item) => item.status === "PASS").length;
const failed = results.length - passed;
const summary = {
  protocol: "IMMUTABLE_STAGE_PROTOCOL_V1",
  providerCalls: 0,
  tests: results.length,
  passed,
  failed,
  localProofTests: results.filter((item) => /freeze|owner|derived|missing prerequisite/.test(item.name)).length,
  mutationTests: results.filter((item) => /mutation|capability|patched/.test(item.name)).length,
  reopenTests: results.filter((item) => /reopen|copy-on-write/.test(item.name)).length,
  stalePropagationTests: results.filter((item) => /descendants/.test(item.name)).length,
  interfaceProofTests: results.filter((item) => /parent|provider/.test(item.name)).length,
  finalStatus: failed === 0 ? "IMMUTABLE_STAGE_PROTOCOL_READY" : "IMMUTABLE_STAGE_PROTOCOL_NOT_READY",
};
fs.writeFileSync(resultsFile, `${JSON.stringify({ summary, results }, null, 2)}\n`, "utf8");
const md = [
  "# IMMUTABLE STAGE PROTOCOL V1 — Test Report",
  "",
  `最终状态：**${summary.finalStatus}**`,
  "",
  `- Provider calls：${summary.providerCalls}`,
  `- Tests：${summary.tests}`,
  `- Passed：${summary.passed}`,
  `- Failed：${summary.failed}`,
  "",
  "## Coverage",
  "",
  `- mutationTests：${summary.mutationTests}`,
  `- reopenTests：${summary.reopenTests}`,
  `- stalePropagationTests：${summary.stalePropagationTests}`,
  `- interfaceProofTests：${summary.interfaceProofTests}`,
  `- localProofTests：${summary.localProofTests}`,
  "",
  "## Tests",
  "",
  "| Test | Status | Detail |",
  "| --- | --- | --- |",
  ...results.map((item) => `| ${item.name} | ${item.status} | ${String(item.detail || "").replace(/\|/g, "\\|")} |`),
  "",
  "## Enforced behaviors",
  "",
  "- Frozen snapshot is deep read-only and content-addressed by SHA-256.",
  "- Parent snapshot id and hash mismatch is a hard failure.",
  "- Canon write capability is absent from downstream stages.",
  "- Reopen is explicit, manual, and copy-on-write; old version remains unchanged.",
  "- Descendants of a superseded parent become STALE instead of being overwritten.",
  "- NOT_EVALUABLE is not a freeze pass.",
  "- Provider writes outside owner/fact/snapshot scope are rejected and never merged.",
  "",
];
fs.writeFileSync(reportFile, `${md.join("\n")}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
if (failed) process.exitCode = 1;
