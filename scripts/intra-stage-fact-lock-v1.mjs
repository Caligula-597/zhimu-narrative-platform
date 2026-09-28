/**
 * Create the Cluster A intra-stage fact lock and Canon partition DAG.
 * Read-only migration step: no story content is authored or changed.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANON_PARTITION_AUTHORITY_REGISTRY,
  createFactLock,
  contentHash,
} from "../shared/immutable-stage-protocol.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = path.join(ROOT, "captures", "integrated-story-gold", "auction-night-v1");
const CLUSTER_A_DIR = path.join(BASE, "canon-fact-repair-cluster-a-real-v1");
const OUT = path.join(BASE, "intra-stage-fact-lock-v1");

const clusterAValidation = JSON.parse(fs.readFileSync(path.join(CLUSTER_A_DIR, "cluster-a-validation.json"), "utf8"));
const clusterAResult = JSON.parse(fs.readFileSync(path.join(CLUSTER_A_DIR, "canonical-fact-graph-after-cluster-a.json"), "utf8"));
if (clusterAValidation.finalStatus !== "CLUSTER_A_READY") throw new Error("CLUSTER_A_NOT_READY");

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const graph = clusterAResult.graph;
const nodeIndex = new Map();
for (const [type, prefix, idKey] of [
  ["entities", "entity", "entityId"],
  ["events", "event", "eventId"],
  ["relations", "relation", "relationId"],
  ["objectStates", "objectState", "stateId"],
  ["evidence", "evidence", "evidenceId"],
  ["claims", "claim", "claimId"],
  ["mappingMutations", "mappingMutation", "mutationId"],
  ["causalEdges", "causalEdge", "edgeId"],
]) {
  for (const node of graph[type] || []) nodeIndex.set(`${prefix}:${node[idKey]}`, node);
}

const clusterAFactRefs = [
  "entity:TEACHER_UNRESOLVED",
  "entity:ZHOU_MUXIAN",
  "entity:LU_WAN",
  "event:EVT_1937_CLEARANCE",
  "event:EVT_PAST_A_TEACHER_WITHHOLDS_JADE_REGISTRATION",
  "event:EVT_LU_WAN_ACCUSATION",
  "event:EVT_LU_WAN_DEATH",
  "relation:REL_LU_WAN_TO_LU_FAMILY",
  "evidence:original-case-physical-1",
  "evidence:original-case-physical-3",
  "evidence:original-case-physical-4",
  "evidence:jade-registration-page-left-blank",
  "evidence:teacher-private-number-list",
  "evidence:lu-wan-accusation-record",
  "claim:CLAIM_LU_WAN_WAS_LU_AGENT",
  "claim:CLAIM_LU_WAN_ALTERED_MAPPING",
  "causalEdge:CAUSE_LU_WAN_ACCUSATION_TO_DEATH",
  "causalEdge:CAUSE_LU_WAN_DEATH_TO_E_MIRROR_PAPER",
];
const missing = clusterAFactRefs.filter((factRef) => !nodeIndex.has(factRef));
if (missing.length) throw new Error(`CLUSTER_A_LOCK_FACT_MISSING:${missing.join(",")}`);

const lockFacts = clusterAFactRefs.map((factRef) => ({
  factRef,
  value: nodeIndex.get(factRef),
  semanticKey: `${factRef}:canonical-node`,
}));
const lock = createFactLock({
  lockId: "CLUSTER_A_LOCK_V1",
  stageId: "CanonicalFactGraph",
  stageVersion: 1,
  facts: lockFacts,
  frozenByProofRefs: [
    "TEACHER_IDENTITY_RESOLVED",
    "TEACHER_TIMELINE_VALID",
    "TEACHER_KNOWLEDGE_CHAIN_COMPLETE",
    "LU_WAN_IDENTITY_RESOLVED",
    "LU_WAN_ACCUSATION_EVENT_COMPLETE",
    "LU_WAN_DEATH_EVENT_COMPLETE",
    "LU_WAN_CAUSAL_CHAIN_COMPLETE",
    "ORIGINAL_CASE_CONSISTENCY_PASS",
    "ENTITY_TIMELINE_INVARIANTS_PASS",
    "NO_NEW_CONTENT_DEBT",
    "CLUSTER_A_CROSS_TRUTH_CONTRADICTION",
  ],
  frozenAt: "2026-09-14T00:00:00.000Z",
});

const partitionRegistry = {
  protocol: "INTRA_STAGE_FACT_LOCK_V1",
  parentProtocol: "IMMUTABLE_STAGE_PROTOCOL_V1",
  autoReopen: false,
  partitions: [
    { partitionId: "CLUSTER_A", status: "FROZEN", writeOwner: "CanonAuthoring", allowedFactTypes: CANON_PARTITION_AUTHORITY_REGISTRY.CLUSTER_A.allowedFactTypes, dependencies: [] },
    { partitionId: "HISTORICAL_OBJECT_OWNERSHIP", status: "READY_FOR_AUTHORING", writeOwner: "HistoricalOwnershipAuthoring", allowedFactTypes: CANON_PARTITION_AUTHORITY_REGISTRY.HISTORICAL_OBJECT_OWNERSHIP.allowedFactTypes, dependencies: ["CLUSTER_A"], forbiddenFactRefs: clusterAFactRefs },
    { partitionId: "CLUSTER_B", status: "BLOCKED", writeOwner: "ObjectStateCompiler", allowedFactTypes: CANON_PARTITION_AUTHORITY_REGISTRY.CLUSTER_B.allowedFactTypes, dependencies: ["HISTORICAL_OBJECT_OWNERSHIP"], forbiddenFactRefs: clusterAFactRefs },
    { partitionId: "CLUSTER_C", status: "BLOCKED", writeOwner: "MisinformationAuthoring", allowedFactTypes: CANON_PARTITION_AUTHORITY_REGISTRY.CLUSTER_C.allowedFactTypes, dependencies: ["CLUSTER_B"], forbiddenFactRefs: clusterAFactRefs },
    { partitionId: "CLUSTER_D", status: "BLOCKED", writeOwner: "ModernCausalityAuthoring", allowedFactTypes: CANON_PARTITION_AUTHORITY_REGISTRY.CLUSTER_D.allowedFactTypes, dependencies: ["CLUSTER_C"], forbiddenFactRefs: clusterAFactRefs },
  ],
  lockedFactPolicy: {
    directMutation: "LOCKED_FACT_MUTATION_ATTEMPT",
    semanticReplacement: "LOCKED_FACT_SEMANTIC_OVERRIDE",
    automaticUnlock: false,
    reopen: "explicit APPROVE_REOPEN + copy-on-write",
  },
};

const partitionDag = {
  protocol: "INTRA_STAGE_FACT_LOCK_V1",
  nodes: [
    { partitionId: "CLUSTER_A", status: "FROZEN", dependsOn: [] },
    { partitionId: "HISTORICAL_OBJECT_OWNERSHIP", status: "READY_FOR_AUTHORING", dependsOn: ["CLUSTER_A"] },
    { partitionId: "CLUSTER_B", status: "BLOCKED", dependsOn: ["HISTORICAL_OBJECT_OWNERSHIP"] },
    { partitionId: "CLUSTER_C", status: "BLOCKED", dependsOn: ["CLUSTER_B"] },
    { partitionId: "CLUSTER_D", status: "BLOCKED", dependsOn: ["CLUSTER_C"] },
  ],
  edges: [
    ["CLUSTER_A", "HISTORICAL_OBJECT_OWNERSHIP"],
    ["HISTORICAL_OBJECT_OWNERSHIP", "CLUSTER_B"],
    ["CLUSTER_B", "CLUSTER_C"],
    ["CLUSTER_C", "CLUSTER_D"],
  ],
  finalStatus: "CLUSTER_A_FROZEN",
};

writeJson(path.join(OUT, "cluster-a-lock-v1.json"), { ...lock, factCount: lock.factRefs.length, lockedFactRefs: clusterAFactRefs });
writeJson(path.join(OUT, "canon-partition-authority-registry.json"), partitionRegistry);
writeJson(path.join(OUT, "canon-partition-dag.json"), partitionDag);

const report = [
  "# INTRA-STAGE FACT LOCK V1",
  "",
  "最终状态：**INTRA_STAGE_FACT_LOCK_READY**",
  "",
  "```text",
  "Canon Fact Graph        DRAFT",
  "Cluster A                FROZEN",
  "Historical Ownership     READY_FOR_AUTHORING",
  "Cluster B                BLOCKED",
  "Cluster C                BLOCKED",
  "Cluster D                BLOCKED",
  "```",
  "",
  "## Cluster A lock",
  "",
  `- lockId：${lock.lockId}`,
  `- stageId：${lock.stageId}`,
  `- stageVersion：${lock.stageVersion}`,
  `- locked facts：${lock.factRefs.length}`,
  `- aggregateHash：${lock.aggregateHash}`,
  `- status：${lock.status}`,
  "",
  "锁定范围包括周慕先/老师身份链、1937 相关教师事件与证据、陆婉身份、指认与死亡事件、对应关系 Claim、关系、证据和因果边；没有锁定整个 Canon。",
  "",
  "## Write policy",
  "",
  "- Canon Authoring 只能写未锁定事实。",
  "- B/H/C/D 触碰 Cluster A 事实直接硬失败。",
  "- 新节点若使用同一 canonical subject/property/time scope 覆盖已锁事实，报 `LOCKED_FACT_SEMANTIC_OVERRIDE`。",
  "- 自动解锁关闭；只能通过显式 Reopen + copy-on-write。",
  "",
  "## Partition DAG",
  "",
  "```text",
  "CLUSTER_A (FROZEN)",
  "↓",
  "HISTORICAL_OBJECT_OWNERSHIP (READY_FOR_AUTHORING)",
  "↓",
  "CLUSTER_B (BLOCKED)",
  "↓",
  "CLUSTER_C (BLOCKED)",
  "↓",
  "CLUSTER_D (BLOCKED)",
  "```",
  "",
  "## Required next behavior",
  "",
  "H 负责补齐实际归属、实物持有、原始登记、沈氏抄本、战后持有和现代基线持有人。B 只能消费冻结的 H，构建 Object State Ledger；缺失时必须报 `MISSING_FROZEN_UPSTREAM_FACT`，不得自行 author。",
  "",
  "Provider calls：0。故事 Canon 与 derived views 未修改。",
  "",
];
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(ROOT, "intra-stage-fact-lock-v1.md"), `${report.join("\n")}\n`, "utf8");
writeJson(path.join(ROOT, "cluster-a-lock-v1.json"), { ...lock, factCount: lock.factRefs.length, lockedFactRefs: clusterAFactRefs });
writeJson(path.join(ROOT, "canon-partition-authority-registry.json"), partitionRegistry);
writeJson(path.join(ROOT, "canon-partition-dag.json"), partitionDag);
writeJson(path.join(OUT, "cluster-a-lock-v1.json"), { ...lock, factCount: lock.factRefs.length, lockedFactRefs: clusterAFactRefs });
writeJson(path.join(OUT, "canon-partition-authority-registry.json"), partitionRegistry);
writeJson(path.join(OUT, "canon-partition-dag.json"), partitionDag);
console.log(JSON.stringify({ finalStatus: "INTRA_STAGE_FACT_LOCK_READY", providerCalls: 0, lockId: lock.lockId, factCount: lock.factRefs.length, aggregateHash: lock.aggregateHash, outDir: path.relative(ROOT, OUT) }, null, 2));
