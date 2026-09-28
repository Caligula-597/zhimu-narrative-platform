/**
 * Lossless migration of the current Auction Night Canon into a minimal
 * CanonicalFactGraph. Read-only with respect to story truth: conflicts are
 * recorded, never resolved.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { emptyCanonicalFactGraph, canonicalFactGraphNodeCounts } from "../shared/canonical-fact-graph-contract.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "captures", "integrated-story-gold", "auction-night-v1", "canon-gold-pass-1-completion-real-v1");
const OUT = path.join(ROOT, "captures", "integrated-story-gold", "auction-night-v1", "canon-fact-ownership-migration-v1");
const canon = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, "merged-completion-canon.json"), "utf8")).canon;
const crossTruth = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, "gold-pass-1-cross-truth-proof.json"), "utf8"));
const caseTruth = canon.premise?.originalCase || {};
const info = canon.misinformationChain?.[0] || {};
const mirror = info.mirrorPaperTruth || {};
const tampering = info.exactTampering || {};
const reunion = canon.premise?.reunionCause || {};

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function text(value) { return String(value ?? "").trim(); }
function safeId(value) { return text(value).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "UNRESOLVED"; }
function unique(items) { return [...new Set(items.filter(Boolean))]; }
function ref(type, id) { return `${type}:${id}`; }

const graph = emptyCanonicalFactGraph();
const migrationConflicts = [];
const duplicateFactDefinitions = [];
const projectionWriteSources = [];

function conflict(code, pathName, sources, reason, candidates = []) {
  migrationConflicts.push({ code, path: pathName, sources, reason, candidates });
}

// ENTITY nodes: modern slots, named historical actors, family entities and
// unresolved placeholders. We do not collapse unresolved teacher identity.
const entitySpecs = [
  ...canon.characters.map((item) => ({ entityId: `ROLE_${item.roleId}`, name: item.name, kind: "MODERN_ROLE", sourceRefs: [`characters.${item.roleId}`] })),
  { entityId: "PEI_JINGZHI", name: "裴敬之", kind: "HISTORICAL_PERSON", sourceRefs: ["premise.originalCase.actors"] },
  { entityId: "ZHOU_MUXIAN", name: "周慕先", kind: "HISTORICAL_PERSON", sourceRefs: ["premise.originalCase.actors"] },
  { entityId: "SHEN_YANNONG", name: "沈砚农", kind: "HISTORICAL_PERSON", sourceRefs: ["premise.originalCase.actors"] },
  { entityId: "LU_WAN", name: "陆婉", kind: "HISTORICAL_PERSON", sourceRefs: ["misinformationChain[0].mirrorPaperTruth", "pastTruthSpine.past-e-moves-paper-from-mirror"] },
  { entityId: "TEACHER_UNRESOLVED", name: canon.premise.teacherTruth?.identity || "顾沉舟的老师", kind: "UNRESOLVED_PERSON", sourceRefs: ["premise.teacherTruth"] },
  { entityId: "GU_FAMILY", name: "顾氏", kind: "FAMILY", sourceRefs: ["storyObjects.jade-cicada.originalOwner"] },
  { entityId: "LU_FAMILY", name: "陆氏", kind: "FAMILY", sourceRefs: ["storyObjects.bronze-mirror.originalOwner"] },
  { entityId: "HUO_FAMILY", name: "霍氏", kind: "FAMILY", sourceRefs: ["storyObjects.ancient-seal.originalOwner"] },
  { entityId: "QIN_FAMILY", name: "秦氏", kind: "FAMILY", sourceRefs: ["storyObjects.broken-sword.originalOwner"] },
  { entityId: "SHEN_DESCENDANTS", name: "沈氏后人", kind: "FAMILY_DESCENDANTS", sourceRefs: ["misinformationChain[0].gMotive", "premise.reunionCause"] },
  { entityId: "PUBLIC", name: "公众/公开记录", kind: "COLLECTIVE", sourceRefs: ["premise", "pastTruthSpine"] },
  { entityId: "ANONYMOUS_SENDER", name: "匿名信发送者", kind: "UNRESOLVED_PERSON", sourceRefs: ["pastTruthSpine.past-f-receives-anonymous-letter"] },
];
for (const entity of entitySpecs) graph.entities.push({ ...entity, factRef: ref("entity", entity.entityId) });

conflict("TEACHER_IDENTITY_UNRESOLVED", "premise.teacherTruth.identity", ["premise.teacherTruth", "premise.originalCase"], "老师只有泛称，没有与 1937 参与者实体建立唯一等同关系。", ["TEACHER_UNRESOLVED", "ZHOU_MUXIAN", "PEI_JINGZHI"]);

// EVENT nodes: original case is preserved as one event; existing formal events
// are copied. Prose-only major events become migration conflicts, not invented
// Event nodes.
const originalCase = canon.premise.originalCase || {};
graph.events.push({
  eventId: "EVT_1937_CLEARANCE",
  when: originalCase.when || null,
  where: originalCase.where || null,
  actorRefs: ["PEI_JINGZHI", "ZHOU_MUXIAN", "SHEN_YANNONG", "GU_FAMILY", "LU_FAMILY", "HUO_FAMILY", "QIN_FAMILY"],
  whatHappened: originalCase.actions || null,
  decision: originalCase.keyDecision || null,
  outcome: originalCase.canonicalOutcome || null,
  irreversibleChange: originalCase.irreversibleChange || null,
  physicalEvidenceRefs: [],
  knowledgeDistribution: originalCase.knowledgeDistribution || null,
  consequences: originalCase.consequences || null,
  sourceRefs: ["premise.originalCase"],
  authority: "EVENT",
});
for (const event of canon.pastTruthSpine || []) {
  graph.events.push({
    eventId: `EVT_${safeId(event.eventId)}`,
    when: event.when || null,
    where: event.where || null,
    actorRefs: event.actors || [],
    whatHappened: event.whatHappened,
    cause: event.cause,
    consequence: event.consequence,
    relatedObjectRefs: event.relatedObjects || [],
    evidenceRefs: event.evidenceCreated || [],
    knowledgeDistribution: event.knowledgeDistribution || {},
    sourceRefs: [`pastTruthSpine.${event.eventId}`],
    authority: "EVENT",
  });
}
// These are asserted in prose but have no Event owner yet.
conflict("EVENT_IN_PROSE_NOT_FORMALIZED", "mirrorPaperTruth.relevanceToEFamily", ["misinformationChain[0].mirrorPaperTruth.relevanceToEFamily", "pastTruthSpine.past-e-moves-paper-from-mirror.cause"], "陆婉被错误指认并自尽是重大事件，但当前没有独立 Event 节点、时间、指认者和证据。", ["EVT_LU_WAN_ACCUSATION", "EVT_LU_WAN_DEATH"]);

// RELATION nodes are copied from the existing relationship view only. They are
// marked as derived candidates until their event/entity owners are repaired.
for (const [index, relation] of (canon.relationshipHistory || []).entries()) {
  graph.relations.push({
    relationId: `REL_${index + 1}`,
    entityRefs: relation.roles || [],
    pastEventRefs: relation.pastEventRefs || [],
    whatHappenedBetweenThem: relation.whatHappenedBetweenThem,
    currentAttitude: relation.currentAttitude,
    asymmetricKnowledge: relation.asymmetricKnowledge,
    unresolvedIssue: relation.unresolvedIssue,
    sourceRefs: [`relationshipHistory[${index}]`],
    authority: "RELATION",
  });
}

// OBJECT STATE nodes preserve competing candidates rather than picking an
// owner/holder interpretation.
for (const object of canon.storyObjects || []) {
  const owner = text(object.originalOwner);
  const postHolder = text(object.postCaseHolder);
  const recordedOwnerCandidates = [
    { value: owner || null, sourceRef: "premise.originalCase.keyDecision", interpretation: "original-ledger-candidate" },
    { value: "SHEN_CUSTODY", sourceRef: "premise.originalCase.irreversibleChange", interpretation: "Shen-copy-candidate" },
  ];
  graph.objectStates.push({
    stateId: `STATE_${safeId(object.objectId)}_1937`,
    objectId: object.objectId,
    validFrom: "1937",
    validTo: null,
    physicalHolder: null,
    legalOwner: owner || null,
    recordedOwner: null,
    location: null,
    sourceEventRef: "EVT_1937_CLEARANCE",
    candidateValues: {
      legalOwner: owner ? [{ value: owner, sourceRef: "storyObjects.originalOwner" }] : [],
      recordedOwner: recordedOwnerCandidates,
      postCaseHolder: postHolder ? [{ value: postHolder, sourceRef: `storyObjects.${object.objectId}.postCaseHolder` }] : [],
    },
    sourceRefs: [`storyObjects.${object.objectId}`, "premise.originalCase"],
    authority: "OBJECT_STATE",
  });
  conflict("OBJECT_STATE_CANDIDATE_CONFLICT", `storyObjects.${object.objectId}`, [`storyObjects.${object.objectId}`, "premise.originalCase"], "对象条目同时要求原始归属、沈氏抄本归属和后续持有人，但当前文本没有唯一连续状态链。", recordedOwnerCandidates);
}

// EVIDENCE nodes come from explicit event evidence IDs and original-case
// physical evidence. Unknown content remains unresolved rather than invented.
const evidenceSeen = new Set();
function addEvidence(evidenceId, content, createdByEventRef, sourceRefs, holderRefs = [], provesClaimRefs = [], doesNotProveClaimRefs = []) {
  if (evidenceSeen.has(evidenceId)) return;
  evidenceSeen.add(evidenceId);
  graph.evidence.push({ evidenceId, createdByEventRef, content: content || null, holderRefs, provesClaimRefs, doesNotProveClaimRefs, sourceRefs, authority: "EVIDENCE" });
}
for (const event of canon.pastTruthSpine || []) for (const evidenceId of event.evidenceCreated || []) addEvidence(evidenceId, null, `EVT_${safeId(event.eventId)}`, [`pastTruthSpine.${event.eventId}.evidenceCreated`]);
for (const [index, evidence] of (originalCase.physicalEvidence || []).entries()) addEvidence(`original-case-physical-${index + 1}`, evidence, "EVT_1937_CLEARANCE", ["premise.originalCase.physicalEvidence"]);
addEvidence("EVIDENCE_MIRROR_PAPER", mirror.recordedFact, "EVT_PAST_E_MOVES_PAPER_FROM_MIRROR", ["misinformationChain[0].mirrorPaperTruth"], ["ROLE_E", "LU_FAMILY"], ["CLAIM_LU_WAN_WAS_LU_AGENT", "CLAIM_BRONZE_MIRROR_LU_ORIGIN"], ["CLAIM_LU_WAN_ALTERED_MAPPING"]);

// CLAIM nodes make the locked true/false boundary explicit.
graph.claims.push(
  { claimId: "CLAIM_E_MOVED_OBJECT", statement: info.trueBehavior || "陆闻笙移动过一件器物", truthStatus: "TRUE", locked: true, sourceEventRefs: ["EVT_PAST_E_MOVES_PAPER_FROM_MIRROR"], evidenceRefs: ["EVIDENCE_MIRROR_PAPER"], sourceRefs: ["misinformationChain[0].trueBehavior"], authority: "CLAIM" },
  { claimId: "CLAIM_E_MOVED_TO_ALTER_MAPPING", statement: info.falseInterpretation || "陆闻笙移动器物是为了替换身份对应", truthStatus: "FALSE", locked: true, sourceEventRefs: [], evidenceRefs: [], sourceRefs: ["misinformationChain[0].falseInterpretation"], authority: "CLAIM" },
  { claimId: "CLAIM_DOSSIER_LIMITEDLY_MODIFIED", statement: "案卷曾被有限度修改", truthStatus: "TRUE", locked: true, sourceEventRefs: ["EVT_PAST_G_ALTERS_DOSSIER_MAPPING"], evidenceRefs: ["altered-dossier-identity-mapping"], sourceRefs: ["premise.fixedFacts"] , authority: "CLAIM" },
  { claimId: "CLAIM_G_IDENTITY_MAPPING_MODIFIED", statement: "祁衡修改过至少一段身份对应", truthStatus: "TRUE", locked: true, sourceEventRefs: ["EVT_PAST_G_ALTERS_DOSSIER_MAPPING"], evidenceRefs: ["altered-dossier-identity-mapping"], sourceRefs: ["premise.fixedFacts"], authority: "CLAIM" },
  { claimId: "CLAIM_LU_WAN_WAS_LU_AGENT", statement: mirror.realRelationship || "陆婉是陆氏派出的代理人", truthStatus: "TRUE", locked: false, sourceEventRefs: ["EVT_PAST_E_MOVES_PAPER_FROM_MIRROR"], evidenceRefs: ["EVIDENCE_MIRROR_PAPER"], sourceRefs: ["misinformationChain[0].mirrorPaperTruth.realRelationship"], authority: "CLAIM" },
  { claimId: "CLAIM_BRONZE_MIRROR_LU_ORIGIN", statement: "青铜镜原属陆氏旧藏", truthStatus: "TRUE", locked: false, sourceEventRefs: ["EVT_1937_CLEARANCE"], evidenceRefs: ["EVIDENCE_MIRROR_PAPER"], sourceRefs: ["storyObjects.bronze-mirror.provenance"], authority: "CLAIM" },
);
conflict("LOCKED_MISINFORMATION_DRIFT", "misinformationChain[0]", ["misinformationChain[0].falseInterpretation", "misinformationChain[0].exactTampering"], "当前 MappingMutation 将 E 的现代行为改挂到陆婉，不能直接支持 locked false claim‘E 为替换身份对应而移动’。", ["CLAIM_E_MOVED_OBJECT", "CLAIM_E_MOVED_TO_ALTER_MAPPING"]);

// Mapping mutations are explicit, separate from prose claims.
graph.mappingMutations.push({
  mutationId: "MUT_SHEN_COPY_MAPPING_1937",
  actorRef: "SHEN_YANNONG",
  targetMapping: "four-object-recorded-owner-mapping",
  before: "原始登记册对四件器物的真实归属/旧编号记录",
  after: "沈氏抄本补写玉蝉为沈氏所有，并将青铜镜、古印、断剑对应改为沈氏代管",
  motiveRefs: [],
  evidenceRefs: ["original-case-physical-2"],
  sourceEventRef: "EVT_1937_CLEARANCE",
  sourceRefs: ["premise.originalCase.irreversibleChange"],
  authority: "MAPPING_MUTATION",
});
graph.mappingMutations.push({
  mutationId: "MUT_G_DOSSIER_MAPPING",
  actorRef: "ROLE_G",
  targetMapping: "E-action-framing",
  before: tampering.before || null,
  after: tampering.after || null,
  motiveRefs: ["CLAIM_G_IDENTITY_MAPPING_MODIFIED"],
  evidenceRefs: ["altered-dossier-identity-mapping"],
  sourceEventRef: "EVT_PAST_G_ALTERS_DOSSIER_MAPPING",
  sourceRefs: ["misinformationChain[0].exactTampering"],
  authority: "MAPPING_MUTATION",
});

// Explicit causal edges are copied from causal prose, but never used to hide
// missing alternatives. The missing counterfactuals are reported below.
graph.causalEdges.push(
  { edgeId: "CAUSE_1937_TO_SCATTER", fromFactRef: "EVT_1937_CLEARANCE", toFactRef: "OBJECT_STATE_SCATTERED", relation: "CAUSED", reason: caseTruth.irreversibleChange, sourceRefs: ["premise.originalCase.irreversibleChange"], authority: "CAUSAL_EDGE" },
  { edgeId: "CAUSE_SCATTER_TO_REASSEMBLY", fromFactRef: "OBJECT_STATE_SCATTERED", toFactRef: "REUNION_REQUIRED", relation: "CREATED_NEED", reason: "四件器物分别保存了不同侧面的旧案证据，需要重新汇聚。", sourceRefs: ["premise.reunionCause", "storyObjects.*.reunionReason"], authority: "CAUSAL_EDGE" },
  { edgeId: "CAUSE_DISCOVERY_TO_AUCTION", fromFactRef: "REUNION_DISCOVERY", toFactRef: "EVT_AUCTION_ASSEMBLY", relation: "LED_TO", reason: reunion.triggeringDiscovery || null, sourceRefs: ["premise.reunionCause.triggeringDiscovery"], authority: "CAUSAL_EDGE" },
  { edgeId: "CAUSE_AUCTION_TO_DOSSIER_OPEN", fromFactRef: "EVT_FINAL_LOT_SOLD", toFactRef: "DOSSIER_OPENED", relation: "TRIGGERS", reason: "案卷会在最后一件拍品落槌后打开。", sourceRefs: ["premise.fixedFacts"], authority: "CAUSAL_EDGE" },
);
conflict("CAUSAL_EDGE_MISSING_COUNTERFACTUAL", "premise.reunionCause", ["premise.reunionCause"], "为什么选择私人拍卖而非私下交接/公开展览、为什么必须今晚，当前没有被拒绝方案及失败原因。", ["private-transfer", "public-exhibition", "another-night"]);
conflict("DOSSIER_OPENING_CAUSE_MISSING", "premise.fixedFacts", ["premise.fixedFacts"], "最后一件拍品落槌后案卷打开只有流程触发，缺少世界内开启原因。", []);

duplicateFactDefinitions.push(
  { fact: "object ownership / recorded mapping", currentDefinitions: ["premise.originalCase", "storyObjects", "misinformationChain", "premise.reunionCause"], owner: "ObjectStateLedger" },
  { fact: "E moved paper / false motive", currentDefinitions: ["pastTruthSpine", "mirrorPaperTruth", "misinformationChain", "exactTampering"], owner: "Claim + MappingMutation" },
  { fact: "Lu Wan identity/death", currentDefinitions: ["mirrorPaperTruth", "characters.E", "pastTruthSpine prose"], owner: "Entity + Event" },
  { fact: "G motive / leverage", currentDefinitions: ["characters.G", "gMotive", "reunionCause"], owner: "Event + Evidence + CausalEdge" },
);

for (const view of ["premise", "pastTruthSpine", "characters", "relationshipHistory", "storyObjects", "misinformationChain"]) {
  projectionWriteSources.push({ view, status: "DERIVED_CANON_VIEW", readOnly: true, authority: "canonicalFactGraph", currentSource: "legacy-authored-or-mixed", writePermission: false });
}

const summary = {
  requestType: "CANON_FACT_OWNERSHIP_MIGRATION",
  providerCalls: 0,
  migratedEntities: graph.entities.length,
  migratedEvents: graph.events.length,
  migratedRelations: graph.relations.length,
  migratedObjectStates: graph.objectStates.length,
  migratedEvidence: graph.evidence.length,
  migratedClaims: graph.claims.length,
  migratedMutations: graph.mappingMutations.length,
  migratedCausalEdges: graph.causalEdges.length,
  migrationConflicts: migrationConflicts.length,
  duplicateFactDefinitions: duplicateFactDefinitions.length,
  projectionWriteSources: projectionWriteSources.length,
  graphNodeCounts: canonicalFactGraphNodeCounts(graph),
  finalStatus: "FACT_GRAPH_READY_FOR_REPAIR",
  canonModified: false,
  downstreamExecuted: false,
};

fs.mkdirSync(OUT, { recursive: true });
writeJson(path.join(OUT, "canonical-fact-graph-migration.json"), { requestType: summary.requestType, source: path.relative(ROOT, path.join(SOURCE_DIR, "merged-completion-canon.json")), graph, derivedViews: projectionWriteSources, summary });
writeJson(path.join(OUT, "canon-fact-graph-conflicts.json"), { requestType: "CANON_FACT_GRAPH_MIGRATION_CONFLICTS", conflicts: migrationConflicts, duplicateFactDefinitions, summary });
const md = [
  "# Canon Fact Ownership / Single Source of Truth Migration",
  "",
  "> Lossless migration only. Provider calls = 0. Current Canon 未修改；冲突没有被自动选择。",
  "",
  "## Summary",
  "",
  "```json",
  JSON.stringify(summary, null, 2),
  "```",
  "",
  "## Ownership rules",
  "",
  "- Entity / Relation：身份、家族、代际与人物关系",
  "- Event：时间、地点、参与者、行为、决定、结果",
  "- ObjectState：physicalHolder、legalOwner、recordedOwner、location 的时间链",
  "- Evidence：证据内容、持有人、证明/不证明的 Claim",
  "- Claim：true/false proposition 与 locked boundary",
  "- MappingMutation：before/after 身份对应变更",
  "- CausalEdge：cause → effect 及后续反事实补充位置",
  "",
  "## Derived views",
  "",
  ...projectionWriteSources.map((item) => `- ${item.view}: ${item.status}; readOnly=${item.readOnly}; writePermission=${item.writePermission}`),
  "",
  "## Migration conflicts",
  "",
  ...migrationConflicts.map((item) => [
    `### ${item.code}｜${item.path}`,
    `- 来源：${item.sources.join("；")}`,
    `- 原因：${item.reason}`,
    `- 候选：${JSON.stringify(item.candidates)}`,
  ].join("\n")),
  "",
  "## Duplicate fact definitions",
  "",
  ...duplicateFactDefinitions.map((item) => `- ${item.fact}：${item.currentDefinitions.join("、")} → 唯一 owner 应为 ${item.owner}`),
  "",
  "## Freeze policy",
  "",
  "Canon Freeze 后所有下游只能读取 graph projection。发现问题只能生成 UPSTREAM_REOPEN_REQUEST，不得在 Kernel、P5、P6、Writer、GAME 或 Runtime 本地修正。",
].join("\n") + "\n";
fs.writeFileSync(path.join(OUT, "canon-fact-ownership-report.md"), md, "utf8");
console.log(JSON.stringify({ outDir: path.relative(ROOT, OUT), ...summary }, null, 2));
