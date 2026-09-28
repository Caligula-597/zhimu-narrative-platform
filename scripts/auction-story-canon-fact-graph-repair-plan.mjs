/**
 * Build the Canonical Fact Graph repair plan without changing Canon and
 * without calling a Provider. This file turns migration conflicts into
 * explicit repair targets and a dependency-aware authoring plan.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = path.join(ROOT, "captures", "integrated-story-gold", "auction-night-v1");
const MIGRATION_DIR = path.join(BASE, "canon-fact-ownership-migration-v1");
const SOURCE_DIR = path.join(BASE, "canon-gold-pass-1-completion-real-v1");
const OUT = path.join(BASE, "canon-fact-graph-repair-plan-v1");

const migration = JSON.parse(fs.readFileSync(path.join(MIGRATION_DIR, "canonical-fact-graph-migration.json"), "utf8"));
const conflictReport = JSON.parse(fs.readFileSync(path.join(MIGRATION_DIR, "canon-fact-graph-conflicts.json"), "utf8"));
const canon = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, "merged-completion-canon.json"), "utf8")).canon;
const graph = migration.graph;

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function text(value) { return String(value ?? "").trim(); }
function unique(items) { return [...new Set(items.filter(Boolean))]; }
function conflict(code, pathPrefix = "") {
  return conflictReport.conflicts.find((item) => item.code === code && (!pathPrefix || item.path.startsWith(pathPrefix))) || null;
}
function sourceRefsOf(item) { return item ? item.sourceRefs || item.sources || [] : []; }

const views = ["premise", "pastTruthSpine", "characters", "relationshipHistory", "storyObjects", "misinformationChain"];
const allGraphRefs = graph ? {
  entities: graph.entities.map((item) => `entity:${item.entityId}`),
  events: graph.events.map((item) => `event:${item.eventId}`),
  relations: graph.relations.map((item) => `relation:${item.relationId}`),
  objectStates: graph.objectStates.map((item) => `objectState:${item.stateId}`),
  evidence: graph.evidence.map((item) => `evidence:${item.evidenceId}`),
  claims: graph.claims.map((item) => `claim:${item.claimId}`),
  mappingMutations: graph.mappingMutations.map((item) => `mappingMutation:${item.mutationId}`),
  causalEdges: graph.causalEdges.map((item) => `causalEdge:${item.edgeId}`),
} : {};

const targetList = [];
function addTarget({
  repairId,
  cluster,
  repairType,
  factOwner,
  targetFactRefs,
  currentCandidates = [],
  sourceRefs = [],
  brokenInvariants = [],
  canonicalQuestion,
  requiredDecision,
  lockedConstraints = [],
  allowedMutationScope = [],
  affectedFactRefs = [],
  affectedDerivedViews = views,
  requiredProof = [],
  dependsOn = [],
}) {
  targetList.push({
    repairId,
    cluster,
    repairType,
    factOwner,
    targetFactRefs: unique(targetFactRefs),
    currentCandidates,
    sourceRefs: unique(sourceRefs),
    brokenInvariants: unique(brokenInvariants),
    canonicalQuestion,
    requiredDecision,
    lockedConstraints: unique(lockedConstraints),
    allowedMutationScope: unique(allowedMutationScope),
    affectedFactRefs: unique(affectedFactRefs),
    affectedDerivedViews: unique(affectedDerivedViews),
    requiredProof: unique(requiredProof),
    dependsOn: unique(dependsOn),
  });
}

const teacherConflict = conflict("TEACHER_IDENTITY_UNRESOLVED");
const luConflict = conflict("EVENT_IN_PROSE_NOT_FORMALIZED");

// Cluster A — the two historical identity/timeline authoring decisions.
addTarget({
  repairId: "A_TEACHER_IDENTITY_TIMELINE",
  cluster: "HISTORICAL_IDENTITY_TIMELINE",
  repairType: "AUTHORING_REPAIR",
  factOwner: "Entity + Relation + Event + Evidence + CausalEdge",
  targetFactRefs: ["entity:TEACHER_UNRESOLVED", "event:EVT_1937_CLEARANCE", "relation:teacher-to-role-A"],
  currentCandidates: teacherConflict?.candidates || ["TEACHER_UNRESOLVED", "ZHOU_MUXIAN", "PEI_JINGZHI"],
  sourceRefs: ["premise.teacherTruth", "premise.originalCase", "pastTruthSpine.past-a-teacher-withholds-jade-registration"],
  brokenInvariants: ["ENTITY_IDENTITY_UNIQUE", "TIMELINE_PARTICIPATION_POSSIBLE", "KNOWLEDGE_TRANSFER_EXPLICIT"],
  canonicalQuestion: "顾沉舟的老师是谁？他是否能在 1937 年参与清河旧藏清点，并通过哪一事件把玉蝉规则传给顾沉舟？",
  requiredDecision: ["teacherEntityRef", "relationToA", "birthOrLifeRange", "participatedIn1937", "knowledgeSourceEventRefs", "evidenceRetainedRefs", "knowledgeTransferToA"],
  lockedConstraints: ["不能把泛称老师静默等同于历史人物", "不能改变顾沉舟已知的三年前整理经历", "不能改变玉蝉留空这一锁定事实"],
  allowedMutationScope: ["entities:TEACHER_UNRESOLVED", "entities:<selected teacher>", "relations:<teacher-A>", "events:<teacher participation/knowledge transfer>", "evidence:<teacher retained evidence>", "causalEdges:<teacher knowledge transfer>"],
  affectedFactRefs: ["entity:TEACHER_UNRESOLVED", "entity:ROLE_A", "event:EVT_1937_CLEARANCE", "event:EVT_PAST_A_TEACHER_WITHHOLDS_JADE_REGISTRATION", "evidence:teacher-private-number-list", "evidence:jade-registration-page-left-blank"],
  requiredProof: ["teacher identity is unique", "1937 timeline is possible", "A receives knowledge through explicit source event", "no teacher identity is inferred from prose after repair"],
});

addTarget({
  repairId: "A_LU_WAN_ACCUSATION_DEATH",
  cluster: "HISTORICAL_IDENTITY_TIMELINE",
  repairType: "AUTHORING_REPAIR",
  factOwner: "Entity + Relation + Event + Evidence + CausalEdge",
  targetFactRefs: ["entity:LU_WAN", "event:EVT_LU_WAN_ACCUSATION", "event:EVT_LU_WAN_DEATH", "relation:lu-wan-to-lu-family"],
  currentCandidates: luConflict?.candidates || ["EVT_LU_WAN_ACCUSATION", "EVT_LU_WAN_DEATH"],
  sourceRefs: ["misinformationChain[0].mirrorPaperTruth.relevanceToEFamily", "pastTruthSpine.past-e-moves-paper-from-mirror.cause", "premise.originalCase.consequences"],
  brokenInvariants: ["EVENT_FORMALIZED", "ACCUSATION_EVIDENCE_CHAIN_COMPLETE", "DEATH_CONSEQUENCE_CAUSAL"],
  canonicalQuestion: "陆婉何时、被谁、依据什么被指认？她为何自尽，这件事如何影响陆家与现代陆闻笙？",
  requiredDecision: ["accusationEvent", "accuser", "accusationClaim", "evidenceUsed", "truthStatus", "beneficiary", "consequence", "deathEvent", "impactOnLuFamily", "modernEvidenceRefs"],
  lockedConstraints: ["不能把陆婉改成 G 的现代篡改者", "不能改变 E 确实移动过薄纸且未修改案卷", "不能让陆婉自尽成为无证据背景句"],
  allowedMutationScope: ["entities:LU_WAN", "events:EVT_LU_WAN_ACCUSATION", "events:EVT_LU_WAN_DEATH", "relations:LU_WAN/FAMILY", "evidence:<accusation evidence>", "causalEdges:<accusation-to-death>"],
  affectedFactRefs: ["entity:LU_WAN", "entity:LU_FAMILY", "event:EVT_PAST_E_MOVES_PAPER_FROM_MIRROR", "claim:CLAIM_LU_WAN_WAS_LU_AGENT", "evidence:EVIDENCE_MIRROR_PAPER"],
  requiredProof: ["accusation event has accuser and evidence", "death event has cause and time relation", "modern E evidence points back without changing ownership", "Lu Wan remains distinct from G"],
});

// Cluster B — one target per object, preserving known values and requiring a
// complete state chain rather than patching storyObjects prose.
const objectIds = (canon.storyObjects || []).map((item) => item.objectId);
const objectStateStages = ["PRE_1937", "ORIGINAL_LEDGER", "SHEN_COPY", "POST_CASE", "POST_WAR", "MODERN", "PRE_AUCTION", "AUCTION"];
for (const objectId of objectIds) {
  const object = canon.storyObjects.find((item) => item.objectId === objectId) || {};
  const objectConflict = conflict("OBJECT_STATE_CANDIDATE_CONFLICT", `storyObjects.${objectId}`);
  const stateRefs = objectStateStages.map((stage) => `objectState:${objectId}:${stage}`);
  addTarget({
    repairId: `B_OBJECT_STATE_${objectId.replace(/-/g, "_").toUpperCase()}`,
    cluster: "OBJECT_STATE_LEDGER",
    repairType: "AUTHORING_REPAIR",
    factOwner: "ObjectStateLedger",
    targetFactRefs: stateRefs,
    currentCandidates: [{
      objectId,
      originalOwner: object.originalOwner || null,
      postCaseHolder: object.postCaseHolder || null,
      recordedOwnerCandidates: objectConflict?.candidates || [],
      knownSourceRefs: object.sourceRefs || object.pastEventRefs || [],
    }],
    sourceRefs: [`storyObjects.${objectId}`, "premise.originalCase", ...(object.pastEventRefs || [])],
    brokenInvariants: ["OBJECT_STATE_CONTINUITY", "OBJECT_STATE_TRANSITION_COMPLETE", "PHYSICAL_LEGAL_RECORDED_OWNER_DISTINCT"],
    canonicalQuestion: `${object.name || objectId} 在八个时间节点分别由谁持有、归谁所有、登记为何、位于何处？每一次转移由哪一事件造成？`,
    requiredDecision: objectStateStages.flatMap((stage) => [
      `${stage}.physicalHolder`, `${stage}.legalOwner`, `${stage}.recordedOwner`, `${stage}.location`, `${stage}.sourceEventRef`,
    ]),
    lockedConstraints: ["不得在 storyObjects prose 中修复", "不得把 legalOwner、physicalHolder、recordedOwner 混成一个字段", "已知 originalOwner 与 postCaseHolder 必须保留并可追溯"],
    allowedMutationScope: [`objectStates:${objectId}:*`, "events:<object transfer events>", "evidence:<object custody evidence>", "causalEdges:<object transitions>"],
    affectedFactRefs: [`entity:${object.originalOwner || "UNRESOLVED_OWNER"}`, ...stateRefs, ...(object.pastEventRefs || []).map((id) => `event:${id}`)],
    requiredProof: ["all eight stages exist", "adjacent stages have explicit sourceEventRef", "no state jump without event", "four-object removal proof passes", "post-war holder and modern holder are derivable"],
    dependsOn: ["A_TEACHER_IDENTITY_TIMELINE", "A_LU_WAN_ACCUSATION_DEATH"],
  });
}

const info = canon.misinformationChain?.[0] || {};
const tampering = info.exactTampering || {};
// Cluster C is deterministic because the current Canon already contains one
// exact before/after mapping and the two locked claims. No new story decision
// is requested here; the repair only binds those values to graph ownership.
addTarget({
  repairId: "C_E_ACTION_MAPPING_MUTATION_SUPPORT",
  cluster: "MISINFORMATION_MAPPING",
  repairType: "DETERMINISTIC_REPAIR",
  factOwner: "Claim + MappingMutation + Evidence",
  targetFactRefs: ["claim:CLAIM_E_MOVED_OBJECT", "claim:CLAIM_E_MOVED_TO_ALTER_MAPPING", "mappingMutation:MUT_G_DOSSIER_MAPPING", "evidence:EVIDENCE_MIRROR_PAPER"],
  currentCandidates: [{
    currentBefore: tampering.before || null,
    currentAfter: tampering.after || null,
    supportedTrueClaim: info.trueBehavior || null,
    supportedFalseClaim: info.falseInterpretation || null,
  }],
  sourceRefs: ["misinformationChain[0].trueBehavior", "misinformationChain[0].falseInterpretation", "misinformationChain[0].exactTampering", "pastTruthSpine.past-e-moves-paper-from-mirror", "pastTruthSpine.past-g-alters-dossier-mapping"],
  brokenInvariants: ["LOCKED_CLAIM_TO_MUTATION_BOUND", "MAPPING_MUTATION_TEMPORAL_VALIDITY", "MAPPING_MUTATION_STRUCTURAL_VALIDITY"],
  canonicalQuestion: "G 的修改是否只把 E 的真实行为改挂到陆婉，并由此支撑错误动机，而没有改变 E 的真实行为？",
  requiredDecision: ["currentBefore", "currentAfter", "supportedTrueClaim", "supportedFalseClaim", "temporalValidity", "structuralValidity"],
  lockedConstraints: ["CLAIM_E_MOVED_OBJECT = TRUE", "CLAIM_E_MOVED_TO_ALTER_MAPPING = FALSE", "G_IDENTITY_MAPPING_MODIFIED = TRUE", "不得把陆婉替换为真正的历史篡改者"],
  allowedMutationScope: ["claims:CLAIM_E_MOVED_OBJECT", "claims:CLAIM_E_MOVED_TO_ALTER_MAPPING", "mappingMutations:MUT_G_DOSSIER_MAPPING", "evidence:EVIDENCE_MIRROR_PAPER"],
  affectedFactRefs: ["event:EVT_PAST_E_MOVES_PAPER_FROM_MIRROR", "event:EVT_PAST_G_ALTERS_DOSSIER_MAPPING", "entity:ROLE_E", "entity:ROLE_G", "entity:LU_WAN"],
  requiredProof: ["true behavior remains true", "false motive remains false", "before/after mapping is explicit", "G modification occurs after E behavior", "evidence supports behavior but not motive"],
  dependsOn: ["A_LU_WAN_ACCUSATION_DEATH", ...objectIds.map((id) => `B_OBJECT_STATE_${id.replace(/-/g, "_").toUpperCase()}`)],
});

const allB = objectIds.map((id) => `B_OBJECT_STATE_${id.replace(/-/g, "_").toUpperCase()}`);
const D = [
  {
    id: "D_G_HIGH_RISK_DECISION",
    question: "祁衡为什么承担修改案卷的高风险？为什么不能通过更简单、低风险的办法保护沈氏后人？",
    decision: ["selectedOption", "cause", "requiredConditions", "alternatives", "rejectedBecause"],
    refs: ["causalEdge:G_HIGH_RISK_MAPPING_DECISION", "event:EVT_PAST_G_ALTERS_DOSSIER_MAPPING"],
    sources: ["misinformationChain[0].gMotive", "pastTruthSpine.past-g-alters-dossier-mapping", "premise.reunionCause"],
    proof: ["G alternative action proof", "selected action requires existing evidence and timing", "rejected alternatives are materially different"],
    depends: ["C_E_ACTION_MAPPING_MUTATION_SUPPORT"],
  },
  {
    id: "D_FOUR_OBJECT_NECESSITY",
    question: "为什么四件器物必须全部在场，而不是只需要青铜镜或案卷残卷？",
    decision: ["selectedOption", "cause", "requiredConditions", "alternatives", "rejectedBecause"],
    refs: ["causalEdge:FOUR_OBJECT_NECESSITY"],
    sources: ["premise.reunionCause.whyFourObjectsTogether", "storyObjects.*.reunionReason", "storyObjects.*.evidenceOf"],
    proof: ["four-object removal proof", "removing any one object removes a distinct required capability/evidence", "no object is only decorative"],
    depends: allB,
  },
  {
    id: "D_REUNION_CAUSALITY",
    question: "为什么四件器物与案卷要在同一事件中重新汇聚？",
    decision: ["selectedOption", "cause", "requiredConditions", "alternatives", "rejectedBecause"],
    refs: ["causalEdge:REUNION_DISCOVERY_TO_ASSEMBLY", "event:EVT_AUCTION_ASSEMBLY"],
    sources: ["premise.reunionCause", "premise.canonicalTruth", "storyObjects.*.reunionReason"],
    proof: ["reunion causality is non-tautological", "all required conditions are sourced", "alternative gathering methods are explicitly rejected"],
    depends: [...allB, "C_E_ACTION_MAPPING_MUTATION_SUPPORT"],
  },
  {
    id: "D_AUCTION_CHOICE",
    question: "为什么选择私人拍卖，而不是私下收购、私下交接或公开展览？",
    decision: ["selectedOption", "cause", "requiredConditions", "alternatives", "rejectedBecause"],
    refs: ["causalEdge:AUCTION_SELECTION", "event:EVT_AUCTION_ASSEMBLY"],
    sources: ["premise.reunionCause.whyAuction", "premise.reunionCause.whyDossierTogether", "premise.worldBackground"],
    proof: ["auction counterfactual proof", "auction creates a necessary public/private pressure combination", "alternatives fail for stated world reasons"],
    depends: ["D_REUNION_CAUSALITY"],
  },
  {
    id: "D_WHY_TONIGHT",
    question: "为什么必须是今晚，而不是任何其他时间？",
    decision: ["selectedOption", "cause", "requiredConditions", "alternatives", "rejectedBecause"],
    refs: ["causalEdge:WHY_TONIGHT", "event:EVT_AUCTION_ASSEMBLY"],
    sources: ["premise.reunionCause.whyNow", "premise.fixedFacts", "premise.timeRange"],
    proof: ["why-tonight proof", "time condition is world-causal rather than procedural", "another-night alternative fails"],
    depends: ["D_AUCTION_CHOICE", "D_REUNION_CAUSALITY"],
  },
  {
    id: "D_DOSSIER_OPENING_CAUSE",
    question: "案卷为什么会在最后一件拍品落槌后打开？世界内的开启条件是什么？",
    decision: ["selectedOption", "cause", "requiredConditions", "alternatives", "rejectedBecause"],
    refs: ["causalEdge:DOSSIER_OPENING_CAUSE", "event:EVT_FINAL_LOT_SOLD", "event:EVT_DOSSIER_OPENED"],
    sources: ["premise.fixedFacts", "premise.reunionCause.whyNow", "premise.worldBackground"],
    proof: ["dossier opening world cause", "opening condition is not merely ‘because the script says so’", "opening is consistent with object and dossier states"],
    depends: ["D_WHY_TONIGHT"],
  },
];
for (const item of D) addTarget({
  repairId: item.id,
  cluster: "MODERN_CAUSALITY",
  repairType: "AUTHORING_REPAIR",
  factOwner: "Event + Evidence + CausalEdge",
  targetFactRefs: item.refs,
  currentCandidates: [],
  sourceRefs: item.sources,
  brokenInvariants: ["CAUSAL_EDGE_EXPLICIT", "COUNTERFACTUAL_NON_TAUTOLOGICAL", "EVENT_TRIGGER_WORLD_CAUSE"],
  canonicalQuestion: item.question,
  requiredDecision: item.decision,
  lockedConstraints: ["不能用同义反复填充 cause", "不能改变 Canonical Truth", "不能把流程触发冒充世界内原因", "不能让玩家行为改写历史事实"],
  allowedMutationScope: ["events:<modern causal events>", "evidence:<causal evidence>", `causalEdges:${item.id}`],
  affectedFactRefs: item.refs,
  requiredProof: item.proof,
  dependsOn: item.depends,
});

const targetById = new Map(targetList.map((item) => [item.repairId, item]));
for (const target of targetList) {
  target.dependencyState = target.dependsOn.length ? "BLOCKED_BY_REPAIR" : "OPEN";
}
const blockedTargets = targetList
  .filter((item) => item.dependencyState === "BLOCKED_BY_REPAIR")
  .map((item) => ({ repairId: item.repairId, blockedBy: item.dependsOn }));

const deterministicTargets = targetList.filter((item) => item.repairType === "DETERMINISTIC_REPAIR");
const authoringTargets = targetList.filter((item) => item.repairType === "AUTHORING_REPAIR");
const authoringPlan = {
  requestType: "FACT_GRAPH_REPAIR_AUTHORING_PACKET_PLAN",
  providerCalls: 0,
  writeTargets: authoringTargets.map((target) => ({
    repairId: target.repairId,
    cluster: target.cluster,
    factOwner: target.factOwner,
    repairType: target.repairType,
    targetFactRefs: target.targetFactRefs,
    canonicalQuestion: target.canonicalQuestion,
    requiredDecision: target.requiredDecision,
    lockedConstraints: target.lockedConstraints,
    contextEvidenceRefs: target.sourceRefs,
    contextMode: "READ_ONLY_EVIDENCE",
    writeScope: target.allowedMutationScope,
    dependsOn: target.dependsOn,
    dependencyState: target.dependencyState,
  })),
  forbiddenWriteTargets: views.map((view) => `derivedView:${view}`),
  finalStatus: "FACT_GRAPH_REPAIR_PLAN_READY",
};

const summary = {
  requestType: "CANON_FACT_GRAPH_REPAIR_PLAN",
  sourceMigrationStatus: migration.summary.finalStatus,
  providerCalls: 0,
  totalRepairTargets: targetList.length,
  deterministicRepairTargets: deterministicTargets.length,
  authoringRepairTargets: authoringTargets.length,
  clusterCounts: Object.fromEntries(["HISTORICAL_IDENTITY_TIMELINE", "OBJECT_STATE_LEDGER", "MISINFORMATION_MAPPING", "MODERN_CAUSALITY"].map((cluster) => [cluster, targetList.filter((item) => item.cluster === cluster).length])),
  blockedTargetCount: blockedTargets.length,
  affectedDerivedViews: views,
  canonModified: false,
  derivedViewsRegenerated: false,
  downstreamExecuted: false,
  finalStatus: "FACT_GRAPH_REPAIR_PLAN_READY",
};

const plan = {
  ...summary,
  repairTargets: targetList,
  repairDependencies: targetList.map((item) => ({ repairId: item.repairId, dependsOn: item.dependsOn, dependencyState: item.dependencyState })),
  blockedTargets,
  repairOrder: ["HISTORICAL_IDENTITY_TIMELINE", "OBJECT_STATE_LEDGER", "MISINFORMATION_MAPPING", "MODERN_CAUSALITY"],
  freezePolicy: {
    canonWritePermission: false,
    downstreamWritePermission: false,
    failureAction: "UPSTREAM_REOPEN_REQUEST",
    invalidationAction: "invalidate descendants then regenerate projections after repair",
  },
};

fs.mkdirSync(OUT, { recursive: true });
writeJson(path.join(OUT, "canon-fact-graph-repair-plan.json"), plan);
writeJson(path.join(OUT, "fact-graph-repair-authoring-plan.json"), authoringPlan);

const lines = [
  "# Canon Fact Graph Repair Plan",
  "",
  "> Design-only repair plan. Provider calls = 0. Canon and derived views were not modified.",
  "",
  "## Status",
  "",
  `- Final status: **${summary.finalStatus}**`,
  `- Total targets: **${summary.totalRepairTargets}**`,
  `- Deterministic repairs: **${summary.deterministicRepairTargets}**`,
  `- Authoring repairs: **${summary.authoringRepairTargets}**`,
  `- Blocked by dependency: **${summary.blockedTargetCount}**`,
  `- Provider calls: **0**`,
  "",
  "## Repair order",
  "",
  "```text",
  "A  HISTORICAL_IDENTITY_TIMELINE",
  "↓",
  "B  OBJECT_STATE_LEDGER",
  "↓",
  "C  MISINFORMATION_MAPPING",
  "↓",
  "D  MODERN_CAUSALITY",
  "```",
  "",
  "## Target index",
  "",
  "| Repair ID | Cluster | Type | Dependency state |",
  "| --- | --- | --- | --- |",
  ...targetList.map((item) => `| ${item.repairId} | ${item.cluster} | ${item.repairType} | ${item.dependencyState}${item.dependsOn.length ? ` (${item.dependsOn.join(", ")})` : ""} |`),
  "",
  "## Cluster A — Historical Identity / Timeline",
  "",
  ...targetList.filter((item) => item.cluster === "HISTORICAL_IDENTITY_TIMELINE").flatMap((item) => [
    `### ${item.repairId}`,
    `- 问题：${item.canonicalQuestion}`,
    `- 事实 owner：${item.factOwner}`,
    `- 必须裁决：${item.requiredDecision.join("；")}`,
    `- 必须证明：${item.requiredProof.join("；")}`,
    "",
  ]),
  "## Cluster B — Four Object State Ledgers",
  "",
  `每件器物都必须完成：${objectStateStages.join(" → ")}。每个状态必须有 physicalHolder、legalOwner、recordedOwner、location、sourceEventRef。`,
  "",
  ...targetList.filter((item) => item.cluster === "OBJECT_STATE_LEDGER").map((item) => `- **${item.repairId}**：${item.canonicalQuestion}`),
  "",
  "## Cluster C — Misinformation / Mapping Mutation",
  "",
  ...targetList.filter((item) => item.cluster === "MISINFORMATION_MAPPING").flatMap((item) => [
    `### ${item.repairId}`,
    "- `CLAIM_E_MOVED_OBJECT = TRUE` 必须保持。",
    "- `CLAIM_E_MOVED_TO_ALTER_MAPPING = FALSE` 必须保持。",
    "- 当前唯一答案可先做确定性绑定；若验证失败，才升级为 MAPPING_MUTATION_REDESIGN_REQUIRED。",
    `- 必须证明：${item.requiredProof.join("；")}`,
    "",
  ]),
  "## Cluster D — Modern Causality / Reunion",
  "",
  ...targetList.filter((item) => item.cluster === "MODERN_CAUSALITY").flatMap((item) => [
    `### ${item.repairId}`,
    `- 问题：${item.canonicalQuestion}`,
    "- 结构：selectedOption / cause / requiredConditions / alternatives[] / rejectedBecause[]",
    `- 必须证明：${item.requiredProof.join("；")}`,
    "",
  ]),
  "## Repair dependency DAG",
  "",
  ...targetList.map((item) => `- ${item.repairId} ← ${item.dependsOn.length ? item.dependsOn.join(", ") : "OPEN"}`),
  "",
  "## Provider authoring boundary",
  "",
  "- 只允许将 `AUTHORING_REPAIR` 作为未来 authoring packet 的写入目标。",
  "- 当前计划中的上下文全部是 `READ_ONLY_EVIDENCE`。",
  "- derived Canon views 不得作为写入目标。",
  "- 依赖未解决的 target 标记为 `BLOCKED_BY_REPAIR`，不得提前 author。",
  "",
  "## Freeze policy",
  "",
  "`CANON_FROZEN → CANON_WRITE_PERMISSION = FALSE`。下游发现问题只能生成 `UPSTREAM_REOPEN_REQUEST`；完成上游修复后，必须失效后代、重新投影并重跑 proofs。",
  "",
];
fs.writeFileSync(path.join(OUT, "canon-fact-graph-repair-plan.md"), `${lines.join("\n")}\n`, "utf8");

console.log(JSON.stringify({ outDir: path.relative(ROOT, OUT), ...summary }, null, 2));
