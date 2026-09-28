/**
 * CANON GOLD PASS 1 — CROSS-TRUTH PROOF.
 * Read-only semantic audit. No provider, no Canon mutation, no downstream.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "captures", "integrated-story-gold", "auction-night-v1", "canon-gold-pass-1-completion-real-v1");
const canon = JSON.parse(fs.readFileSync(path.join(DIR, "merged-completion-canon.json"), "utf8")).canon;
const caseTruth = canon.premise.originalCase || {};
const objects = canon.storyObjects || [];
const info = canon.misinformationChain?.[0] || {};
const mirror = info.mirrorPaperTruth || {};
const motive = info.gMotive || {};
const tampering = info.exactTampering || {};
const reunion = canon.premise.reunionCause || {};
const events = canon.pastTruthSpine || [];
const eEvent = events.find((item) => item.eventId === "past-e-moves-paper-from-mirror") || {};
const gEvent = events.find((item) => item.eventId === "past-g-alters-dossier-mapping") || {};
const originalEvent = events.find((item) => /1937|清河旧藏清点案/.test(`${item.when} ${item.whatHappened}`)) || {};

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function nonEmpty(value) { return typeof value === "string" ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : Boolean(value && typeof value === "object" && Object.keys(value).length); }
function row(id, category, status, question, evidence, implication, refs = []) { return { id, category, status, question, evidence, implication, refs }; }

const rows = [];

// 1. Ownership: compare the old-case outcome against every later holder.
const outcomeSaysWrongRecipients = /错误的人/.test(caseTruth.canonicalOutcome || "");
for (const object of objects) {
  const laterHolder = object.postCaseHolder || "";
  const originalOwner = object.originalOwner || "";
  rows.push(row(
    `ownership.${object.objectId}`,
    "OWNERSHIP_CONSISTENCY",
    outcomeSaysWrongRecipients && new RegExp(originalOwner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(laterHolder) ? "CONTRADICTION" : "CAUSAL_GAP",
    `${object.name} 从 1937 原始归属到旧案后持有人是否闭合？`,
    `canonicalOutcome=${caseTruth.canonicalOutcome}\noriginalOwner=${originalOwner}\npostCaseHolder=${laterHolder}\nseparationCause=${object.separationCause}`,
    outcomeSaysWrongRecipients && laterHolder.includes(originalOwner)
      ? "原案说器物归还给错误的人，但对象条目又让它回到原家族后人；缺少中间转手事实或两处陈述互相冲突。"
      : "所有权/实际持有人/现代持有人之间仍缺少可验证的逐段转移链。",
    ["premise.originalCase.canonicalOutcome", `storyObjects.${object.objectId}.postCaseHolder`],
  ));
}

// 2. Original ledger versus Shen copy.
const originalLedger = caseTruth.keyDecision || "";
const shenCopy = caseTruth.irreversibleChange || "";
rows.push(row(
  "original-case.ledger-vs-copy",
  "ORIGINAL_CASE_CONSISTENCY",
  /按沈氏提供的对应关系登记/.test(originalLedger) && /从原持有人改写成沈氏代管|对应关系.*调换/.test(shenCopy) ? "CONTRADICTION" : "PASS",
  "原始登记册到底写了什么，沈氏抄本到底改了什么？",
  `ORIGINAL_LEDGER=${originalLedger}\nSHEN_COPY=${shenCopy}`,
  "同一批青铜镜、古印、断剑既被写成原册已经按沈氏关系登记，又被写成抄本从原持有人改成沈氏代管，当前无法判定哪个是原始记录。",
  ["premise.originalCase.keyDecision", "premise.originalCase.irreversibleChange"],
));

// 3. Timeline and teacher identity.
rows.push(row(
  "timeline.teacher-1937",
  "TIMELINE_CONSISTENCY",
  "CAUSAL_GAP",
  "顾沉舟的老师如何在 1937 年参与旧案并活到现代？",
  `original case=${caseTruth.when}\nteacher=${canon.premise.teacherTruth?.roleInOriginalCase || ""}\nmodern setting=${canon.premise.setting}`,
  "老师的姓名、出生年代、1937 年身份与现代师生关系没有进入 Canon；当前不能证明时间可行。",
  ["premise.originalCase.when", "premise.teacherTruth", "characters.A"],
));
rows.push(row(
  "teacher.identity",
  "TEACHER_IDENTITY_PROOF",
  "CAUSAL_GAP",
  "顾沉舟的老师究竟是谁？",
  `teacherTruth.identity=${canon.premise.teacherTruth?.identity || ""}\nroleInOriginalCase=${canon.premise.teacherTruth?.roleInOriginalCase || ""}`,
  "只给出了泛称‘顾沉舟的老师’，没有说明他是裴敬之、周慕先还是第三人，也没有说明他如何获得并传递旧案证据。",
  ["premise.teacherTruth.identity", "premise.teacherTruth.knowledgeSource"],
));

// 4. Lu Wan event debt.
rows.push(row(
  "lu-wan.death-causality",
  "LU_WAN_CAUSAL_PROOF",
  "CONTENT_DEBT",
  "陆婉为何被错误指认并自尽？",
  `mirror relevance=${mirror.relevanceToEFamily || ""}\nE event cause=${eEvent.cause || ""}\ncase consequences=${(caseTruth.consequences || []).join("；")}`,
  "陆婉自尽是新增重大事件，但没有指认者、发生时间、证据、受益者及其如何进入现代家族秘密的完整因果。",
  ["misinformationChain[0].mirrorPaperTruth.relevanceToEFamily", "pastTruthSpine.past-e-moves-paper-from-mirror.cause"],
));

// 5. G motive must explain why tampering was selected over alternatives.
rows.push(row(
  "g.motive-action",
  "G_MOTIVE_ACTION_PROOF",
  "CAUSAL_GAP",
  "G 为什么必须篡改，而不是销毁、偷走、取消拍卖或收买持有人？",
  JSON.stringify(motive, null, 2),
  "已有保护对象、威胁与自我正当化，但没有排除其他可行方案；祁衡承担高风险的必要性仍未证明。",
  ["misinformationChain[0].gMotive"],
));

// 6. Tampering drift and time plausibility.
const mapsEToLuWan = /陆闻笙.*薄纸/.test(tampering.before || "") && /陆婉/.test(tampering.after || "");
rows.push(row(
  "tampering.locked-boundary",
  "TAMPERING_PLAUSIBILITY",
  mapsEToLuWan ? "CONTRADICTION" : "PASS",
  "篡改前后是否仍支持 locked false interpretation：E 的真实行为被错误解释为 E 为替换身份对应而移动？",
  `locked false=${info.falseInterpretation || ""}\nBEFORE=${tampering.before || ""}\nAFTER=${tampering.after || ""}`,
  mapsEToLuWan
    ? "当前 AFTER 把 E 的现代行为改挂到 1937 年陆婉，并把陆婉写成篡改者；这已经从‘E 的真实行为被误解’漂移成‘陆婉是历史篡改者’，且跨代时间无法成立。"
    : "篡改映射暂未发现跨越 locked false interpretation 的漂移。",
  ["misinformationChain[0].falseInterpretation", "misinformationChain[0].exactTampering"],
));

// 7. Four-object necessity: current text asserts need, but no counterfactual proof.
for (const object of objects) {
  rows.push(row(
    `necessity.${object.objectId}`,
    "FOUR_OBJECT_NECESSITY",
    "CAUSAL_GAP",
    `移除${object.name}后，核心历史、G 计划和终局证明分别哪里失败？`,
    `reunionReason=${object.reunionReason || ""}`,
    "当前只说祁衡需要该物件，没有说明缺少它会导致哪一条不可替代的证据链断裂。",
    [`storyObjects.${object.objectId}.reunionReason`],
  ));
}

// 8. Reunion tautologies and dossier opening cause.
const reunionTautology = [reunion.whyFourObjectsTogether, reunion.whyDossierTogether, reunion.whyAuction]
  .filter(nonEmpty)
  .every((value) => /需要四件器物|安排进同一场拍卖|私人拍卖作为/.test(value));
rows.push(row(
  "reunion.counterfactual",
  "REUNION_CAUSAL_PROOF",
  reunionTautology ? "TAUTOLOGICAL_ANSWER" : "CAUSAL_GAP",
  "为什么必须四物、案卷、私人拍卖在今晚重聚，而不是采用更简单的方案？",
  JSON.stringify(reunion, null, 2),
  "whyFourObjectsTogether、whyDossierTogether、whyAuction 主要重复‘需要/安排/选择’，没有说明其他方案具体失败在哪里。",
  ["premise.reunionCause"],
));
rows.push(row(
  "dossier.opening-world-cause",
  "DOSSIER_OPENING_WORLD_CAUSE",
  "CAUSAL_GAP",
  "为什么最后一件拍品落槌后案卷会打开？",
  `fixed fact=${(canon.premise.fixedFacts || []).find((item) => /落槌后打开/.test(item)) || ""}\nreunion whyNow=${reunion.whyNow || ""}`,
  "当前只有 GAME/流程触发描述，没有世界内的开启者、装置、绑定原因、提前知情者及不可提前开启的理由。",
  ["premise.fixedFacts", "premise.reunionCause.whyNow"],
));

// 9. Newly introduced major facts with no upstream cause.
const newDebtTerms = [
  { term: "陆婉自尽", evidence: `${eEvent.cause} ${(caseTruth.consequences || []).join("；")}`, reason: "没有独立事件、指认者、时间和证据来源。" },
  { term: "祁衡三年前留下的把柄", evidence: `${motive.consequenceIfNoTampering || ""} ${motive.personalJustification || ""}`, reason: "没有说明把柄具体是什么、何时形成、为何能控制祁衡。" },
  { term: "沈氏旧案追责", evidence: `${caseTruth.consequences?.join("；") || ""} ${motive.consequenceIfNoTampering || ""}`, reason: "追责主体、法律/家族机制和触发条件未定义。" },
];
for (const debt of newDebtTerms) rows.push(row(`debt.${debt.term}`, "NO_NEW_CONTENT_DEBT", "CONTENT_DEBT", `新增事实‘${debt.term}’是否有完整上游因果？`, debt.evidence, debt.reason, []));

const blockers = rows.filter((item) => item.status !== "PASS");
const summary = {
  requestType: "CANON_GOLD_PASS_1_CROSS_TRUTH_PROOF",
  providerCalls: 0,
  totalChecks: rows.length,
  crossTruthBlockerCount: blockers.length,
  byCategory: Object.fromEntries([...new Set(rows.map((item) => item.category))].map((category) => [category, rows.filter((item) => item.category === category).filter((item) => item.status !== "PASS").length])),
  byStatus: Object.fromEntries([...new Set(rows.map((item) => item.status))].map((status) => [status, rows.filter((item) => item.status === status).length])),
  finalStatus: blockers.length ? "GOLD_PASS_1_FULL_SCORE_NOT_READY" : "GOLD_PASS_1_FULL_SCORE_READY",
  canonModified: false,
  downstreamExecuted: false,
};
writeJson(path.join(DIR, "gold-pass-1-cross-truth-proof.json"), { summary, checks: rows });
const markdown = [
  "# CANON GOLD PASS 1 — CROSS-TRUTH PROOF",
  "",
  "> Read-only audit. Provider calls = 0. Canon 未修改；未进入 Pass 2。",
  "",
  "## Summary",
  "",
  "```json",
  JSON.stringify(summary, null, 2),
  "```",
  "",
  "## Proof results",
  "",
  ...rows.map((item) => [
    `### ${item.status}｜${item.id}`,
    `- 类别：${item.category}`,
    `- 问题：${item.question}`,
    `- 证据：\n${item.evidence}`,
    `- 结论：${item.implication}`,
    `- 引用：${item.refs.join("；") || "None"}`,
  ].join("\n")),
  "",
  "## Interpretation",
  "",
  "当前 Canon 只能称为 Truth Block Populated / Mother Story Candidate，不能称为 Cross-Truth Proven 或 Full-Score Ready。",
  "",
  "下一步需要先建立事实唯一归属与依赖传播规则，再针对这些 blocker 做受控修订；本报告本身不执行修订。",
].join("\n") + "\n";
fs.writeFileSync(path.join(DIR, "canon-gold-pass-1-cross-truth-proof.md"), markdown, "utf8");
console.log(JSON.stringify({ outDir: path.relative(ROOT, DIR), ...summary }, null, 2));
