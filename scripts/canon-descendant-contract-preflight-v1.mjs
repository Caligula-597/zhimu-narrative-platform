/**
 * CANON_DESCENDANT_CONTRACT_PREFLIGHT_V1
 *
 * Read-only closure audit for frozen Canon partitions. It expands known
 * descendant input contracts without executing B/C/D, derived-view rebuilds,
 * Kernel, P5, P6, Writer, or Runtime. No Provider calls are allowed here.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contentHash, verifyFactLockHash } from "../shared/immutable-stage-protocol.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = path.join(ROOT, "captures", "integrated-story-gold", "auction-night-v1");
const A_DIR = path.join(BASE, "canon-fact-repair-cluster-a-real-v1");
const H_DIR = path.join(BASE, "historical-object-ownership-v1");
const PLAN_DIR = path.join(BASE, "canon-fact-graph-repair-plan-v1");
const OUT = path.join(BASE, "canon-descendant-contract-preflight-v1");

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function text(value) { return String(value ?? "").trim(); }
function arr(value) { return Array.isArray(value) ? value : []; }
function unique(items) { return [...new Set(items.filter(Boolean))]; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

const aResult = readJson(path.join(A_DIR, "canonical-fact-graph-after-cluster-a.json"));
const aValidation = readJson(path.join(A_DIR, "cluster-a-validation.json"));
const aLock = readJson(path.join(ROOT, "cluster-a-lock-v1.json"));
const hResult = readJson(path.join(H_DIR, "canonical-fact-graph-after-h.json"));
const hValidation = readJson(path.join(H_DIR, "historical-object-ownership-validation.json"));
const hLock = readJson(path.join(H_DIR, "historical-object-ownership-lock-v1.json"));
const plan = readJson(path.join(PLAN_DIR, "canon-fact-graph-repair-plan.json"));
const graph = hResult.graph;

const objects = ["jade-cicada", "bronze-mirror", "ancient-seal", "broken-sword"];
const hStages = ["pre1937", "originalLedger1937", "shenCopy1937", "postCase", "postWar", "modernBaseline"];
const bStages = ["PRE_1937", "1937_ORIGINAL_LEDGER", "1937_SHEN_COPY", "POST_CASE", "POST_WAR", "MODERN", "PRE_AUCTION", "AUCTION"];
const derivedViews = ["premise", "pastTruthSpine", "characters", "relationshipHistory", "storyObjects", "misinformationChain"];

const aliasToGraphRef = {
  "event:past-a-teacher-withholds-jade-registration": "event:EVT_PAST_A_TEACHER_WITHHOLDS_JADE_REGISTRATION",
  "event:past-b-collector-network": "event:EVT_PAST_B_COLLECTOR_NETWORK",
  "event:past-c-archive-case": "event:EVT_PAST_C_ARCHIVE_CASE",
  "event:past-d-family-commissions": "event:EVT_PAST_D_FAMILY_COMMISSIONS",
  "event:past-e-moves-paper-from-mirror": "event:EVT_PAST_E_MOVES_PAPER_FROM_MIRROR",
  "event:past-f-receives-anonymous-letter": "event:EVT_PAST_F_RECEIVES_ANONYMOUS_LETTER",
  "event:past-f-dispute-with-g": "event:EVT_PAST_F_DISPUTE_WITH_G",
  "event:past-g-organizes-genealogy": "event:EVT_PAST_G_ORGANIZES_GENEALOGY",
  "event:past-g-alters-dossier-mapping": "event:EVT_PAST_G_ALTERS_DOSSIER_MAPPING",
  "entity:清河旧藏原持有人顾氏": "entity:GU_FAMILY",
  "entity:清河旧藏原持有人陆氏": "entity:LU_FAMILY",
  "entity:清河旧藏原持有人霍氏": "entity:HUO_FAMILY",
  "entity:清河旧藏原持有人秦氏": "entity:QIN_FAMILY",
};
function normalizeRef(ref) { return aliasToGraphRef[ref] || ref; }

const nodeIdKeys = {
  entity: ["entities", "entityId"],
  event: ["events", "eventId"],
  relation: ["relations", "relationId"],
  evidence: ["evidence", "evidenceId"],
  claim: ["claims", "claimId"],
  causalEdge: ["causalEdges", "edgeId"],
};
const availableNodeRefs = new Set();
for (const [type, [collection, idKey]] of Object.entries(nodeIdKeys)) {
  for (const node of arr(graph[collection])) availableNodeRefs.add(`${type}:${node[idKey]}`);
}
for (const factRef of arr(aLock.factRefs)) availableNodeRefs.add(factRef);
for (const factRef of arr(hLock.factRefs)) availableNodeRefs.add(factRef);
for (const objectId of objects) for (const stage of hStages) availableNodeRefs.add(`objectOwnership:${objectId}:${stage}`);

const repairTargets = arr(plan.repairTargets);
const targetById = new Map(repairTargets.map((target) => [target.repairId, target]));
const targetOutputRefs = new Map();
for (const target of repairTargets) {
  const refs = arr(target.affectedFactRefs).map(normalizeRef);
  targetOutputRefs.set(target.repairId, refs);
}

const aOwned = new Set(aLock.factRefs);
const hOwned = new Set(arr(hLock.factRefs));
for (const objectId of objects) for (const stage of hStages) hOwned.add(`objectOwnership:${objectId}:${stage}`);
const bOwned = new Set();
const cOwned = new Set();
const dOwned = new Set();
for (const target of repairTargets) {
  const targetSet = target.cluster === "OBJECT_STATE_LEDGER" ? bOwned : target.cluster === "MISINFORMATION_MAPPING" ? cOwned : target.cluster === "MODERN_CAUSALITY" ? dOwned : null;
  if (targetSet) for (const ref of targetOutputRefs.get(target.repairId) || []) targetSet.add(ref);
}

function sourceStatus(ref) {
  const normalized = normalizeRef(ref);
  if (aOwned.has(normalized)) return { status: "FROZEN_UPSTREAM", owner: "CLUSTER_A", ref: normalized };
  if (hOwned.has(normalized)) return { status: "FROZEN_UPSTREAM", owner: "HISTORICAL_OBJECT_OWNERSHIP", ref: normalized };
  if (bOwned.has(normalized)) return { status: "DOWNSTREAM_PRODUCED", owner: "OBJECT_STATE_LEDGER_COMPILATION", ref: normalized };
  if (cOwned.has(normalized)) return { status: "DOWNSTREAM_PRODUCED", owner: "CLUSTER_C", ref: normalized };
  if (dOwned.has(normalized)) return { status: "DOWNSTREAM_PRODUCED", owner: "CLUSTER_D", ref: normalized };
  if (availableNodeRefs.has(normalized)) return { status: "PRESENT_BUT_UNLOCKED", owner: "UNASSIGNED", ref: normalized };
  return { status: "MISSING", owner: "UNASSIGNED", ref: normalized };
}

function requirement(id, consumer, owner, ref, question, source, blocking = true) {
  const resolved = sourceStatus(ref);
  return {
    id,
    consumer,
    owner,
    requestedRef: ref,
    normalizedRef: resolved.ref,
    question,
    source,
    status: resolved.status,
    resolvedOwner: resolved.owner,
    blocking,
    closureBlocking: blocking && ["MISSING", "PRESENT_BUT_UNLOCKED"].includes(resolved.status),
  };
}

const requirements = [];

// A closure: the already-frozen A facts must cover every A-owned question
// that a descendant contract names, not merely A's local proof list.
const aFutureQuestions = [
  ["teacher.identity", "entity:ZHOU_MUXIAN", "Which historical person is the modern character's teacher?"],
  ["teacher.1937-participation", "event:EVT_1937_CLEARANCE", "Can the teacher's 1937 role be anchored to the original case?"],
  ["teacher.knowledge-transfer", "event:EVT_PAST_A_TEACHER_WITHHOLDS_JADE_REGISTRATION", "Can A's private knowledge be sourced?"],
  ["teacher.retained-evidence", "evidence:teacher-private-number-list", "What evidence did the teacher retain?"],
  ["lu-wan.identity", "entity:LU_WAN", "Is Lu Wan distinct and identified as the Lu family agent?"],
  ["lu-wan.accusation", "event:EVT_LU_WAN_ACCUSATION", "What exactly happened in the false accusation?"],
  ["lu-wan.death", "event:EVT_LU_WAN_DEATH", "What event and time relation caused the death?"],
  ["lu-wan.family-relation", "relation:REL_LU_WAN_TO_LU_FAMILY", "How does the historical person connect to the modern family?"],
  ["lu-wan.evidence", "evidence:EVIDENCE_MIRROR_PAPER", "What retained evidence connects the event to modern E?"],
];
for (const [id, ref, question] of aFutureQuestions) requirements.push(requirement(`A.${id}`, "ALL_DESCENDANTS", "CLUSTER_A", ref, question, "A lock + B/C/D/final proof input contracts"));

// H closure: all root ownership questions known to B/C/D and the final proof.
for (const objectId of objects) {
  for (const stage of hStages) {
    requirements.push(requirement(`H.${objectId}.${stage}`, "B/C/D/FINAL", "HISTORICAL_OBJECT_OWNERSHIP", `objectOwnership:${objectId}:${stage}`, `What are legal owner, physical holder, recorded owner, location and source for ${objectId} at ${stage}?`, "H output contract"));
  }
}
for (const entityId of ["ENTITY_GU_AGENT_1937", "ENTITY_LU_AGENT_1937", "ENTITY_HUO_AGENT_1937", "ENTITY_QIN_AGENT_1937"]) {
  requirements.push(requirement(`H.proxy.${entityId}`, "B", "HISTORICAL_OBJECT_OWNERSHIP", `entity:${entityId}`, `Which minimal 1937 proxy entity acted for the corresponding family?`, "H deterministic proxy contract"));
}

// B's current authoring plan is retained as a contract source, but the
// preflight explicitly records that B must become a deterministic consumer.
for (const target of repairTargets.filter((item) => item.cluster === "OBJECT_STATE_LEDGER")) {
  for (const dependency of arr(target.dependsOn)) {
    requirements.push({
      id: `B.${target.repairId}.dependsOn.${dependency}`,
      consumer: "B",
      owner: "HISTORICAL_OBJECT_OWNERSHIP / CLUSTER_A",
      requestedRef: dependency,
      normalizedRef: dependency,
      question: `Can ${target.repairId} consume its frozen upstream dependency?`,
      source: "canon-fact-graph-repair-plan.json",
      status: ["A_TEACHER_IDENTITY_TIMELINE", "A_LU_WAN_ACCUSATION_DEATH"].includes(dependency) ? "FROZEN_UPSTREAM" : "DOWNSTREAM_PRODUCED",
      resolvedOwner: dependency.startsWith("A_") ? "CLUSTER_A" : "HISTORICAL_OBJECT_OWNERSHIP",
      blocking: true,
      closureBlocking: false,
    });
  }
}

// C explicitly needs the historical E/G behavior and H-backed object facts.
const cTarget = repairTargets.find((item) => item.repairId === "C_E_ACTION_MAPPING_MUTATION_SUPPORT");
for (const ref of arr(cTarget?.affectedFactRefs)) {
  const normalized = normalizeRef(ref);
  requirements.push(requirement(`C.input.${ref}`, "C", "CLUSTER_A/H", normalized, "Can C prove true behavior, false explanation, actor identity and historical object context?", "C_E_ACTION_MAPPING_MUTATION_SUPPORT", true));
}
for (const objectId of objects) requirements.push(requirement(`C.object.${objectId}`, "C", "HISTORICAL_OBJECT_OWNERSHIP", `objectOwnership:${objectId}:modernBaseline`, "Can C trace the object and its evidence without rewriting ownership?", "C mapping support contract", true));

// D input contracts are checked as dependency routes, not executed.
for (const target of repairTargets.filter((item) => item.cluster === "MODERN_CAUSALITY")) {
  for (const dependency of arr(target.dependsOn)) {
    const owner = dependency.startsWith("B_") ? "OBJECT_STATE_LEDGER_COMPILATION" : dependency.startsWith("C_") ? "CLUSTER_C" : "CLUSTER_D";
    const status = dependency.startsWith("B_") || dependency.startsWith("C_") ? "DOWNSTREAM_PRODUCED" : "MISSING";
    requirements.push({
      id: `D.${target.repairId}.dependsOn.${dependency}`,
      consumer: "D",
      owner,
      requestedRef: dependency,
      normalizedRef: dependency,
      question: `Can ${target.repairId} receive its required upstream proof?`,
      source: "canon-fact-graph-repair-plan.json",
      status,
      resolvedOwner: owner,
      blocking: true,
      closureBlocking: false,
    });
  }
}

// Final Cross-Truth requirements: these are intentionally explicit. A/H must
// not merely have fields; downstream readers must have a route to the frozen
// roots rather than continuing to read the stale legacy Canon.
for (const ref of aLock.factRefs) requirements.push(requirement(`FINAL.locked.${ref}`, "FINAL_CROSS_TRUTH", "CLUSTER_A", ref, "Can final cross-truth proof re-read this locked A fact?", "Cluster A lock", true));
for (const objectId of objects) requirements.push(requirement(`FINAL.ownership.${objectId}`, "FINAL_CROSS_TRUTH", "HISTORICAL_OBJECT_OWNERSHIP", `objectOwnership:${objectId}:modernBaseline`, `Can final cross-truth proof compare ${objectId} ownership against later holders?`, "H ownership lock", true));
requirements.push({
  id: "FINAL.object-ownership-bridge",
  consumer: "FINAL_CROSS_TRUTH",
  owner: "HISTORICAL_OBJECT_OWNERSHIP",
  requestedRef: "derived-view:storyObjects",
  normalizedRef: "derived-view:storyObjects",
  question: "Does the final proof read H ownership roots instead of stale storyObjects prose?",
  source: "auction-story-canon-gold-pass-1-cross-truth-proof.mjs",
  status: "IMPLEMENTATION_GAP",
  resolvedOwner: "DERIVED_VIEW",
  blocking: true,
  closureBlocking: true,
  reason: "Current proof reads merged-completion-canon.json storyObjects/premise directly; H ownership is not yet bridged into this reader.",
});

// Derived views and the playable chain must have a declared H route before
// A/H can be globally closed. This is a route proof, not a regeneration.
for (const view of derivedViews) {
  requirements.push({
    id: `DERIVED.${view}.h-route`,
    consumer: `DERIVED_VIEW:${view}`,
    owner: "HISTORICAL_OBJECT_OWNERSHIP",
    requestedRef: `derived-view:${view}`,
    normalizedRef: `derived-view:${view}`,
    question: `Can ${view} consume frozen H facts without copying conflicting ownership prose?`,
    source: "affectedDerivedViews + current derived-view readers",
    status: "IMPLEMENTATION_GAP",
    resolvedOwner: "DERIVED_VIEW",
    blocking: true,
    closureBlocking: true,
    reason: "No H-aware bridge/rebuild contract is registered for this derived view yet.",
  });
}
for (const consumer of ["Kernel", "P5", "P6", "Writer", "Runtime"]) {
  requirements.push({
    id: `${consumer}.h-authority-route`,
    consumer,
    owner: "HISTORICAL_OBJECT_OWNERSHIP",
    requestedRef: "H_FROZEN_ROOTS",
    normalizedRef: "H_FROZEN_ROOTS",
    question: `${consumer} can consume H roots through a declared projection route?`,
    source: "global downstream authority contract",
    status: "IMPLEMENTATION_GAP",
    resolvedOwner: consumer,
    blocking: true,
    closureBlocking: true,
    reason: "Current production path still consumes legacy Canon/fixture projections; no registered H root route exists.",
  });
}

// Verify A and H locks independently. This is deliberately read-only.
const aNodeIndex = new Map();
const collectionKeys = { entity: ["entities", "entityId"], event: ["events", "eventId"], relation: ["relations", "relationId"], evidence: ["evidence", "evidenceId"], claim: ["claims", "claimId"], causalEdge: ["causalEdges", "edgeId"] };
for (const [type, [collection, key]] of Object.entries(collectionKeys)) for (const node of arr(graph[collection])) aNodeIndex.set(`${type}:${node[key]}`, node);
let lockErrors = [];
try { verifyFactLockHash(aLock, aLock.factRefs.map((factRef) => ({ factRef, value: aNodeIndex.get(factRef) }))); } catch (error) { lockErrors.push(`A:${error.message}`); }
if (hLock.status !== "LOCKED" || hValidation.finalStatus !== "HISTORICAL_OBJECT_OWNERSHIP_FROZEN") lockErrors.push("H:LOCK_NOT_FROZEN");
if (hLock.status === "LOCKED" && !hLock.aggregateHash) lockErrors.push("H:LOCK_HASH_MISSING");

const closureBlocking = requirements.filter((item) => item.closureBlocking);
const upstreamMissing = requirements.filter((item) => item.closureBlocking && ["MISSING", "PRESENT_BUT_UNLOCKED", "IMPLEMENTATION_GAP"].includes(item.status));
const routeGaps = upstreamMissing.filter((item) => item.status === "IMPLEMENTATION_GAP");
const aUnsatisfied = upstreamMissing.filter((item) => item.status !== "IMPLEMENTATION_GAP" && (item.owner === "CLUSTER_A" || item.id.startsWith("A.")));
const hUnsatisfied = upstreamMissing.filter((item) => item.status !== "IMPLEMENTATION_GAP" && (item.owner === "HISTORICAL_OBJECT_OWNERSHIP" || item.id.startsWith("H.")));
const unownedFacts = requirements.filter((item) => item.closureBlocking && ["PRESENT_BUT_UNLOCKED", "MISSING"].includes(item.status));
const downstreamNotYetProduced = requirements.filter((item) => !item.closureBlocking && item.status === "MISSING");
const summary = {
  requestType: "CANON_DESCENDANT_CONTRACT_PREFLIGHT_V1",
  providerCalls: 0,
  execution: {
    B: false,
    C: false,
    D: false,
    derivedViews: false,
    Kernel: false,
    P5: false,
    P6: false,
    Writer: false,
    Runtime: false,
  },
  frozenPartitions: {
    CLUSTER_A: aValidation.finalStatus === "CLUSTER_A_READY" ? "LOCALLY_FROZEN" : "NOT_FROZEN",
    HISTORICAL_OBJECT_OWNERSHIP: hValidation.finalStatus === "HISTORICAL_OBJECT_OWNERSHIP_FROZEN" ? "LOCALLY_FROZEN" : "NOT_FROZEN",
  },
  requirementCount: requirements.length,
  closureBlockingRequirementCount: closureBlocking.length,
  unsatisfiedDescendantRequirementCount: upstreamMissing.length,
  aUnsatisfiedDescendantRequirementCount: aUnsatisfied.length,
  hUnsatisfiedDescendantRequirementCount: hUnsatisfied.length,
  implementationRouteGapCount: routeGaps.length,
  unownedOrMissingFactCount: unownedFacts.length,
  downstreamNotYetProducedCount: downstreamNotYetProduced.length,
  lockErrors,
  finalStatus: upstreamMissing.length === 0 && lockErrors.length === 0 ? "A_H_GLOBAL_CLOSURE_PASS" : "A_H_GLOBAL_CLOSURE_FAIL",
  nextStageAllowed: upstreamMissing.length === 0 && lockErrors.length === 0,
};

const report = {
  summary,
  contracts: {
    B: {
      mode: "CONSUME_ONLY",
      legacyImplementationDetected: true,
      legacyImplementation: "scripts/auction-story-canon-fact-repair-cluster-b-real.mjs still calls DeepseekScriptWriterLlm and authors eight-stage object ledgers",
      requiredUpstream: requirements.filter((item) => item.consumer === "B" || item.consumer === "B/C/D/FINAL"),
    },
    C: { requiredUpstream: requirements.filter((item) => item.consumer === "C") },
    D: { requiredUpstream: requirements.filter((item) => item.consumer === "D") },
    FINAL_CROSS_TRUTH: { requiredUpstream: requirements.filter((item) => item.consumer === "FINAL_CROSS_TRUTH") },
    DERIVED_AND_PRODUCTION_ROUTES: { requiredUpstream: requirements.filter((item) => item.consumer.startsWith("DERIVED_VIEW:") || ["Kernel", "P5", "P6", "Writer", "Runtime"].includes(item.consumer)) },
  },
  requirements,
  closure: {
    A_UNSATISFIED_DESCENDANT_REQUIREMENTS: aUnsatisfied,
    H_UNSATISFIED_DESCENDANT_REQUIREMENTS: hUnsatisfied,
    IMPLEMENTATION_ROUTE_GAPS: routeGaps,
    DOWNSTREAM_NOT_YET_PRODUCED: downstreamNotYetProduced,
  },
};

writeJson(path.join(OUT, "canon-descendant-contract-preflight-v1.json"), report);
writeJson(path.join(OUT, "canon-descendant-contract-preflight-summary.json"), summary);
const md = [
  "# CANON DESCENDANT CONTRACT PREFLIGHT V1",
  "",
  `最终状态：**${summary.finalStatus}**`,
  "",
  "> 只做静态需求展开与 dry-run interface proof；Provider calls = 0；B/C/D、Derived Views、Kernel、P5/P6、Writer、Runtime 均未执行。",
  "",
  "## Partition state",
  "",
  `- Cluster A：**${summary.frozenPartitions.CLUSTER_A}**`,
  `- Historical Object Ownership：**${summary.frozenPartitions.HISTORICAL_OBJECT_OWNERSHIP}**`,
  `- A/H global closure：**${summary.finalStatus}**`,
  "",
  "## Summary",
  "",
  `- Expanded requirements：${summary.requirementCount}`,
  `- Closure-blocking requirements：${summary.closureBlockingRequirementCount}`,
  `- Unsatisfied descendant requirements：${summary.unsatisfiedDescendantRequirementCount}`,
  `- A unsatisfied descendant requirements：${summary.aUnsatisfiedDescendantRequirementCount}`,
  `- H unsatisfied descendant requirements：${summary.hUnsatisfiedDescendantRequirementCount}`,
  `- Implementation route gaps：${summary.implementationRouteGapCount}`,
  `- Unowned or missing facts：${summary.unownedOrMissingFactCount}`,
  `- Downstream not yet produced（不算 A/H 缺口）：${summary.downstreamNotYetProducedCount}`,
  `- Lock errors：${summary.lockErrors.length}`,
  "",
  "## Unsatisfied descendant requirements",
  "",
  ...(upstreamMissing.length ? upstreamMissing.map((item) => `- **${item.id}**｜${item.consumer}｜${item.status}\n  - 问题：${item.question}\n  - 来源：${item.source}\n  - 原因：${item.reason || "该事实或消费路由尚未满足全局闭包要求。"}`) : ["- none"]),
  "",
  "## Present but not owned / unresolved authority",
  "",
  ...(unownedFacts.length ? unownedFacts.map((item) => `- **${item.id}**｜${item.status}｜${item.normalizedRef}\n  - ${item.question}\n  - 来源：${item.source}`) : ["- none"]),
  "",
  "## B contract correction",
  "",
  "B 的目标合同已标记为 `CONSUME_ONLY` / `OBJECT_STATE_LEDGER_COMPILATION`；现有 B 脚本仍是 Provider authoring 实现，因此本轮将其标记为 stale implementation，不执行它，也不把它的旧行为当作闭包通过证明。",
  "",
  "## Execution proof",
  "",
  ...Object.entries(summary.execution).map(([name, executed]) => `- ${name}: **${executed ? "EXECUTED（错误）" : "NOT EXECUTED"}**`),
  "",
  "## Rule",
  "",
  "只有 `A_H_GLOBAL_CLOSURE_PASS` 才允许进入 B。若为 FAIL，必须先解决全部 `A_UNSATISFIED_DESCENDANT_REQUIREMENTS` / `H_UNSATISFIED_DESCENDANT_REQUIREMENTS`；下游不得自行补上游事实。",
  "",
];
fs.writeFileSync(path.join(OUT, "canon-descendant-contract-preflight-v1.md"), `${md.join("\n")}\n`, "utf8");
writeJson(path.join(ROOT, "canon-descendant-contract-preflight-v1.json"), summary);
fs.writeFileSync(path.join(ROOT, "canon-descendant-contract-preflight-v1.md"), `${md.join("\n")}\n`, "utf8");

console.log(JSON.stringify(summary, null, 2));
