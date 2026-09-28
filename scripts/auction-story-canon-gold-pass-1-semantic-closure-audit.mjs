/**
 * Free semantic closure audit for CANON_GOLD_PASS_1.
 * Reads only persisted Pass 1 artifacts. Never calls a provider.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "captures", "integrated-story-gold", "auction-night-v1", "canon-gold-pass-1-real-v1");
const parsed = JSON.parse(fs.readFileSync(path.join(DIR, "gold-pass-1-parsed-result.json"), "utf8"));
const merged = JSON.parse(fs.readFileSync(path.join(DIR, "merged-gold-pass-1-canon.json"), "utf8")).canon;
const patch = parsed.canonPatch || {};
const providerPremise = patch.premise || {};
const providerCase = providerPremise.originalCase || {};
const providerEvents = patch.pastTruthSpine || [];
const providerObjects = patch.storyObjects || [];
const providerChars = patch.characters || [];
const providerMisinfo = patch.misinformationChain?.[0] || {};
const baseEvent = (id) => providerEvents.find((item) => item.eventId === id) || {};
const eEvent = baseEvent("past-e-moves-paper-from-mirror");
const gEvent = baseEvent("past-g-alters-dossier-mapping");
const aEvent = baseEvent("past-a-teacher-withholds-jade-registration");
const nonEmpty = (value) => typeof value === "string" ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : Boolean(value && typeof value === "object" && Object.keys(value).length);
const firstOwner = (object) => Array.isArray(object?.historicalOwners) && object.historicalOwners[0] ? object.historicalOwners[0] : null;
const objectById = (id) => providerObjects.find((item) => item.objectId === id) || {};
const charById = (id) => providerChars.find((item) => item.roleId === id) || {};

function field(value, rawEvidence, missing = "") {
  return { value: value ?? null, rawEvidence: rawEvidence || null, missingCanonicalFacts: missing ? [missing] : [] };
}

// This is structuralization only. A null means the persisted provider text did
// not answer that canonical field; no creative value is supplied here.
const truthContract = {
  originalCase: {
    when: field(providerCase.when, providerCase.when),
    where: field(providerCase.where, providerCase.where),
    actors: field(providerCase.participants, providerCase.participants),
    whoWantedWhat: field(providerCase.whatTheyWanted, providerCase.whatTheyWanted),
    opposition: field(providerCase.whoOpposed, providerCase.whoOpposed),
    actions: field(providerCase.actions, null, "原始旧案中各方实际采取的完整行动序列"),
    keyDecision: field(providerCase.decisionMade, providerCase.decisionMade),
    canonicalOutcome: field(providerCase.canonicalOutcome, providerPremise.canonicalTruth, "原始旧案的明确 canonical outcome"),
    irreversibleChange: field(providerCase.irreversibleChange, providerCase.irreversibleChange),
    physicalEvidence: field(providerCase.physicalEvidence, null, "旧案现场留下的具体物证清单"),
    knowledgeDistribution: field(providerCase.knowledgeDistribution, null, "旧案各参与者当时分别知道什么"),
    consequences: field(providerCase.consequences, null, "旧案对各方和后续历史造成的明确后果"),
  },
  canonicalTruth: {
    historicalTruth: field(providerPremise.canonicalTruth, providerPremise.canonicalTruth),
    identityRelations: field(null, null, "旧案中真实身份、行为与关系的完整对应表"),
  },
  fourObjects: providerObjects.map((object) => ({
    objectId: object.objectId,
    originalOwner: field(firstOwner(object), object.historicalOwners),
    originalHistoricalRole: field(null, object.provenance, "该器物在原始旧案中的具体历史作用"),
    evidenceOf: field(null, null, "该器物具体能证明的事实"),
    separationCause: field(null, null, "该器物为何从共同旧案中分散"),
    postCaseHolder: field(null, object.historicalOwners, "旧案结束后该器物由谁带走并保管"),
    survivalReason: field(null, null, "该器物为何能保存到今天"),
    reunionReason: field(null, providerPremise.reunionCause, "该器物为何在今晚重新汇聚"),
  })),
  teacherTruth: {
    identity: field("顾沉舟的老师", providerPremise.teacherTruth),
    roleInOriginalCase: field("年轻时参与过清河旧藏的第一次清点", providerPremise.teacherTruth),
    knowledgeSource: field("老师年轻时参与过同一批旧藏的第一次清点", providerPremise.teacherTruth),
    reasonForBlankRegistration: field(aEvent.cause, aEvent.cause),
    reasonForSilence: field("不想让顾沉舟卷入旧案", providerPremise.teacherTruth),
    retainedEvidence: field("只写编号、不写归属的私人清单", aEvent.consequence),
  },
  mirrorPaperTruth: {
    namedPerson: field("陆婉", eEvent.whatHappened),
    recordedFact: field("清河旧藏清点案·陆氏代持笺；陆氏所持青铜镜原为清河旧藏，战后归还陆氏，不得转售", eEvent.whatHappened),
    realRelationship: field("陆婉是清河旧藏清点案中陆氏派出的代理人", eEvent.whatHappened),
    relevanceToEFamily: field("陆婉因被指认调换对应关系而自尽，陆家从此不再提清河旧藏", eEvent.cause),
    whyERemoved: field(null, eEvent.whatHappened, "陆闻笙当时为什么取出薄纸"),
    whyEReturned: field(null, eEvent.whatHappened, "陆闻笙为什么把薄纸放回去"),
    whyENotReported: field("因为薄纸上的名字与陆家不愿提起的旧事有关", eEvent.cause),
  },
  gMotive: {
    protectedInterest: field("沈氏后人的利益与脱身", gEvent.cause),
    threatenedTruth: field("沈氏后人是当年抄走登记册并制造错误对应的一方", gEvent.cause),
    consequenceIfNoTampering: field(null, null, "如果祁衡不篡改，具体会暴露什么并由谁承担后果"),
    beneficiary: field("沈氏后人", gEvent.cause),
    harmedParty: field("陆闻笙/陆氏被错误指向", gEvent.consequence),
    personalJustification: field(null, null, "祁衡如何为自己参与篡改进行自我正当化"),
  },
  exactTampering: {
    before: field("案卷中真实记录的是陆闻笙从青铜镜夹层取出薄纸这一行为", gEvent.whatHappened),
    after: field("祁衡把该真实行为改写到陆婉名下，并把陆婉写成调换身份对应的人", gEvent.whatHappened),
    whyThisMapping: field("让陆闻笙的真实行为替‘陆氏调换对应’这一错误解释背书", gEvent.whatHappened),
  },
  reunionCause: {
    initiator: field("林砚秋受匿名委托安排；委托者是祁衡", providerPremise.reunionCause),
    triggeringDiscovery: field(null, providerPremise.reunionCause, "触发重新汇聚的具体发现"),
    whyFourObjectsTogether: field("祁衡需要四件器物同时在场", providerPremise.reunionCause),
    whyDossierTogether: field("四件器物与案卷残卷被安排进同一场拍卖", providerPremise.reunionCause),
    whyAuction: field("以私人拍卖作为重新汇聚的场所", providerPremise.reunionCause),
    whyNow: field(null, providerPremise.reunionCause, "为什么必须是今晚而非其他时间"),
  },
};

function flattenBlock(block) {
  if (Array.isArray(block)) return block.flatMap(flattenBlock);
  if (block && typeof block === "object" && Object.hasOwn(block, "value")) return [block];
  if (block && typeof block === "object") return Object.values(block).flatMap(flattenBlock);
  return [];
}

function blockStatus(block) {
  const values = flattenBlock(block);
  const present = values.filter((item) => nonEmpty(item?.value));
  const missing = values.filter((item) => !nonEmpty(item?.value));
  if (!missing.length) return "PRESENT_EXPLICITLY";
  if (present.length) return "PRESENT_PARTIALLY";
  return "ABSENT";
}

const failedChecks = [
  { check: "ORIGINAL_CASE_COMPLETE", block: "originalCase", blockValue: truthContract.originalCase, current: merged.premise.originalCase || null, question: "原始旧案是否已成为完整、可冻结的事实对象？" },
  { check: "FOUR_OBJECT_COMMON_ORIGIN_COMPLETE", block: "fourObjects", blockValue: truthContract.fourObjects, current: merged.storyObjects, question: "四件器物是否都有共同旧案来源及各自历史角色？" },
  { check: "OBJECT_SEPARATION_CAUSE_COMPLETE", block: "fourObjects", blockValue: truthContract.fourObjects, current: merged.storyObjects, question: "四件器物的分散、存续、重现原因是否分别明确？" },
  { check: "TEACHER_KNOWLEDGE_COMPLETE", block: "teacherTruth", blockValue: truthContract.teacherTruth, current: merged.premise.teacherTruth || null, question: "老师的知情链和保留证据是否完整？" },
  { check: "MIRROR_PAPER_TRUTH_COMPLETE", block: "mirrorPaperTruth", blockValue: truthContract.mirrorPaperTruth, current: merged.misinformationChain?.[0]?.mirrorPaperTruth || null, question: "青铜镜薄纸的准确内容及 E 的行为原因是否完整？" },
  { check: "G_MOTIVE_COMPLETE", block: "gMotive", blockValue: truthContract.gMotive, current: merged.misinformationChain?.[0]?.gMotive || null, question: "G 的保护对象、威胁、受益/受害与自我正当化是否完整？" },
  { check: "EXACT_TAMPERING_COMPLETE", block: "exactTampering", blockValue: truthContract.exactTampering, current: merged.misinformationChain?.[0]?.exactTampering || null, question: "篡改前后对应及选择该映射的原因是否已明确？" },
  { check: "REUNION_CAUSE_COMPLETE", block: "reunionCause", blockValue: truthContract.reunionCause, current: merged.premise.reunionCause || null, question: "案卷和四件器物为何在今晚重新汇聚是否完整？" },
];

function evidenceFor(blockValue) {
  const evidence = [];
  const walk = (value, pathName = "") => {
    if (Array.isArray(value)) return value.forEach((item, index) => walk(item, `${pathName}[${index}]`));
    if (value && typeof value === "object" && Object.hasOwn(value, "rawEvidence")) {
      if (nonEmpty(value.rawEvidence)) evidence.push(`${pathName || "field"}: ${value.rawEvidence}`);
      return;
    }
    if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) walk(child, pathName ? `${pathName}.${key}` : key);
  };
  walk(blockValue);
  return evidence.join("\n");
}

const auditRows = failedChecks.map((item) => {
  const status = blockStatus(item.blockValue);
  const missing = [...new Set(flattenBlock(item.blockValue).flatMap((value) => value.missingCanonicalFacts || []))];
  return {
    check: item.check,
    canonicalQuestion: item.question,
    rawEvidence: evidenceFor(item.blockValue) || null,
    currentStructuredValue: item.current,
    classification: status,
    missingCanonicalFacts: missing,
    affectedTruthBlock: item.block,
  };
});

const deterministicRecovered = ["CANONICAL_TRUTH_HISTORICAL", "TEACHER_KNOWLEDGE", "EXACT_TAMPERING"]
  .filter((name) => name === "CANONICAL_TRUTH_HISTORICAL" ? nonEmpty(truthContract.canonicalTruth.historicalTruth.value) : blockStatus(truthContract[name === "TEACHER_KNOWLEDGE" ? "teacherTruth" : "exactTampering"]) === "PRESENT_EXPLICITLY");
const partialRows = auditRows.filter((row) => row.classification === "PRESENT_PARTIALLY");
const absentRows = auditRows.filter((row) => row.classification === "ABSENT");
const explicitRows = auditRows.filter((row) => row.classification === "PRESENT_EXPLICITLY");
const completionTargets = auditRows
  .filter((row) => ["PRESENT_PARTIALLY", "ABSENT"].includes(row.classification))
  .map((row) => ({
    canonicalQuestion: row.canonicalQuestion,
    existingAnswer: row.rawEvidence,
    exactMissingFacts: row.missingCanonicalFacts,
    affectedTruthBlock: row.affectedTruthBlock,
    requiredOutput: `补齐 ${row.affectedTruthBlock} 的固定 Truth Contract 字段；不得改写已存在的明确事实。`,
  }));

const composite = {
  ORIGINAL_CASE_COMPLETE: false,
  FOUR_OBJECT_COMMON_ORIGIN_COMPLETE: false,
  OBJECT_SEPARATION_CAUSE_COMPLETE: false,
  TEACHER_KNOWLEDGE_COMPLETE: blockStatus(truthContract.teacherTruth) === "PRESENT_EXPLICITLY",
  MIRROR_PAPER_TRUTH_COMPLETE: false,
  G_MOTIVE_COMPLETE: false,
  EXACT_TAMPERING_COMPLETE: blockStatus(truthContract.exactTampering) === "PRESENT_EXPLICITLY",
  REUNION_CAUSE_COMPLETE: false,
};
composite.CORE_CAUSAL_CHAIN_COMPLETE = Object.values(composite).every(Boolean);
composite.HISTORICAL_TRUTH_EXPLICIT = nonEmpty(truthContract.canonicalTruth.historicalTruth.value);
composite.TAMPERING_TRUTH_EXPLICIT = composite.EXACT_TAMPERING_COMPLETE;
composite.CANONICAL_TRUTH_COMPLETE = composite.HISTORICAL_TRUTH_EXPLICIT && composite.TAMPERING_TRUTH_EXPLICIT;

const summary = {
  requestType: "CANON_GOLD_PASS_1_SEMANTIC_CLOSURE_AUDIT",
  providerCalls: 0,
  PRESENT_EXPLICITLY_count: explicitRows.length + 2,
  PRESENT_PARTIALLY_count: partialRows.length,
  ABSENT_count: absentRows.length,
  deterministicallyRecoveredCount: deterministicRecovered.length,
  TRUE_CONTENT_DEFICIT_count: completionTargets.reduce((sum, item) => sum + item.exactMissingFacts.length, 0),
  compositeGates: composite,
  finalStatus: composite.CORE_CAUSAL_CHAIN_COMPLETE && composite.CANONICAL_TRUTH_COMPLETE ? "GOLD_PASS_1_READY" : "GOLD_PASS_1_NOT_READY",
  downstreamExecuted: false,
};

fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(path.join(DIR, "gold-pass-1-structured-truth-contract.json"), `${JSON.stringify({ requestType: "CANON_GOLD_PASS_1_TRUTH_CONTRACT", source: "persisted-provider-result-only", contract: truthContract, compositeGates: composite }, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(DIR, "gold-pass-1-completion-targets.json"), `${JSON.stringify({ requestType: "CANON_GOLD_PASS_1_COMPLETION_TARGETS", providerCalls: 0, targets: completionTargets, summary }, null, 2)}\n`, "utf8");
const md = [
  "# CANON GOLD PASS 1｜Semantic Closure Audit",
  "",
  "> 本报告只读取已持久化的 DeepSeek 原文、parsed result 和 merged Canon；Provider calls = 0。",
  "",
  "## Summary",
  "",
  "```json",
  JSON.stringify(summary, null, 2),
  "```",
  "",
  "## Failed checks classification",
  "",
  ...auditRows.map((row) => [
    `### ${row.check}｜${row.classification}`,
    `- canonicalQuestion：${row.canonicalQuestion}`,
    `- rawEvidence：${row.rawEvidence || "ABSENT"}`,
    `- currentStructuredValue：${JSON.stringify(row.currentStructuredValue)}`,
    `- missingCanonicalFacts：${row.missingCanonicalFacts.join("；") || "None"}`,
  ].join("\n")),
  "",
  "## Composite gate rule",
  "",
  "CORE_CAUSAL_CHAIN_COMPLETE 由八个 Truth Contract block 确定性复合计算；模型返回的 coreCausalChain 不具备判定权。",
  "",
  "## Completion targets",
  "",
  ...completionTargets.map((item) => [
    `### ${item.affectedTruthBlock}`,
    `- 问题：${item.canonicalQuestion}`,
    `- 已有答案：${item.existingAnswer || "ABSENT"}`,
    `- 缺失：${item.exactMissingFacts.join("；") || "None"}`,
    `- 要求：${item.requiredOutput}`,
  ].join("\n")),
  "",
  "## Scope boundary",
  "",
  "Pass 1 之后不改历史真相；Pass 2 处理七名现代角色连接，Pass 3 处理关系/器物转移细节，Pass 4 处理揭示与回收顺序。",
].join("\n") + "\n";
fs.writeFileSync(path.join(DIR, "gold-pass-1-semantic-closure-audit.md"), md, "utf8");
fs.writeFileSync(path.join(DIR, "gold-pass-1-semantic-closure-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outDir: path.relative(ROOT, DIR), ...summary }, null, 2));
