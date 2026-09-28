import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "captures", "integrated-story-gold", "auction-night-v1", "canon-closure-real-v1");
const source = JSON.parse(fs.readFileSync(path.join(DIR, "canon-full-score-gap-matrix.json"), "utf8"));

const categories = [
  "TRUE_CONTENT_BLOCKER",
  "STRUCTURALIZATION_REQUIRED",
  "DETERMINISTIC_DERIVABLE",
  "QUALITY_MAJOR",
  "QUALITY_MINOR",
  "PASS",
];

function classify(row) {
  if (!row.missing && row.current && row.module.startsWith("RelationshipHistory") && row.required === "关系来自真正 shared Past Event") return "PASS";
  if (!row.missing && row.current && row.required === "至少两条重要人物关系") return "PASS";
  if (row.module === "PastTruthSpine" && row.required.includes("完整戏剧事件字段")) return "STRUCTURALIZATION_REQUIRED";
  if (row.module.startsWith("Characters.") && row.required.includes("人物过去")) return "QUALITY_MAJOR";
  if (row.module.startsWith("Characters.") && row.required.includes("至少两条") && row.missing) return "TRUE_CONTENT_BLOCKER";
  if (row.module.startsWith("RelationshipHistory") && row.required.includes("关系来自")) return "TRUE_CONTENT_BLOCKER";
  if (row.module.startsWith("RelationshipHistory") && row.required.includes("双方当时")) return "STRUCTURALIZATION_REQUIRED";
  if (row.module.startsWith("RelationshipHistory") && row.required.includes("今晚为什么")) return "QUALITY_MAJOR";
  if (row.module.startsWith("StoryObjects") && row.required.includes("共同历史来源")) return "DETERMINISTIC_DERIVABLE";
  if (row.module.startsWith("StoryObjects") && row.required.includes("完整分散")) return "TRUE_CONTENT_BLOCKER";
  if (row.module.startsWith("StoryObjects") && row.required.includes("能证明")) return "DETERMINISTIC_DERIVABLE";
  if (row.module === "Misinformation" && row.required.includes("真实行为")) return "TRUE_CONTENT_BLOCKER";
  if (row.module === "Misinformation" && row.required.includes("多次")) return "TRUE_CONTENT_BLOCKER";
  if (row.module === "Premise" && row.required.includes("结局方向")) return "QUALITY_MAJOR";
  if (row.module === "Premise") return "TRUE_CONTENT_BLOCKER";
  if (row.module === "PastTruthSpine") return "TRUE_CONTENT_BLOCKER";
  return row.blocker ? "QUALITY_MAJOR" : "PASS";
}

function questionFor(item) {
  const text = [item.module, item.required, item.missing].join(" ");
  if (text.includes("多次 reinterpretation")) return "GQ07";
  if (text.includes("G 的具体") || text.includes("altered mapping") || text.includes("误导") || text.includes("多次 reinterpretation")) return "GQ03";
  if (text.includes("StoryObjects") || text.includes("器物") || text.includes("分散") || text.includes("流转")) return "GQ02";
  if (text.includes("今晚") || text.includes("七人") || text.includes("过去矛盾") || text.includes("Premise")) return "GQ04";
  if (text.includes("RelationshipHistory") || text.includes("关系")) return "GQ06";
  if (text.includes("Characters") || text.includes("角色")) return "GQ05";
  if (text.includes("PastTruthSpine") || text.includes("因果链") || text.includes("原始")) return "GQ01";
  return "GQ01";
}

const reclassified = source.rows.map((row) => {
  const category = classify(row);
  return { ...row, originalBlocker: row.blocker, category, storyQuestionId: questionFor({ ...row, category }) };
});

const questionDefinitions = {
  GQ01: {
    title: "原始旧案究竟发生了什么",
    description: "把老师、旧案、四件器物和身份对应收束到同一件具体历史事件。",
    pass: "PASS 1 — CORE HISTORICAL TRUTH",
  },
  GQ02: {
    title: "四件器物为何属于同一历史、如何分散又为何重聚",
    description: "补齐共同来源、分散、转手、隐藏、证据价值与今晚重新出现的原因。",
    pass: "PASS 1 / PASS 3",
  },
  GQ03: {
    title: "祁衡为什么篡改，以及他具体改了什么",
    description: "明确原对应、改后对应、受益对象、E 行为如何被利用，以及最终多层重解释。",
    pass: "PASS 1 — CORE HISTORICAL TRUTH",
  },
  GQ04: {
    title: "为什么七人、四件器物和案卷恰好在今晚汇聚",
    description: "明确拍卖组织者、邀请关系、案卷重聚原因和今晚不可替代的时间条件。",
    pass: "PASS 1 — CORE HISTORICAL TRUTH",
  },
  GQ05: {
    title: "七个人与核心历史的不可替代连接是什么",
    description: "重点补 B、D，并逐角色确认有限认知、误解、风险和个人 payoff；不机械制造 misbelief。",
    pass: "PASS 2 — CHARACTER CAUSALITY",
  },
  GQ06: {
    title: "主要关系过去如何真实发生，并为何今晚重新生效",
    description: "确保关系来自 shared event，包含关键选择、信息不对称、遗留矛盾和今晚触发。",
    pass: "PASS 3 — RELATIONSHIP + OBJECT HISTORY",
  },
  GQ07: {
    title: "终局如何让旧事实获得多层新意义",
    description: "让老师留白、玉蝉、薄纸、霍家、匿名信、断剑和祁衡动机收束到连续 reinterpretation。",
    pass: "PASS 4 — REVEAL + PAYOFF",
  },
};

const summary = Object.fromEntries(categories.map((category) => [
  category,
  reclassified.filter((row) => row.category === category).length,
]));
const questions = Object.entries(questionDefinitions).map(([id, definition]) => {
  const items = reclassified.filter((row) => row.storyQuestionId === id);
  return {
    storyQuestionId: id,
    ...definition,
    affectedChecks: items.map((row) => row.module + " :: " + row.required),
    affectedCharacters: [...new Set(items.filter((row) => row.module.startsWith("Characters.")).map((row) => row.module.split(".")[1]))],
    affectedObjects: [...new Set(items.filter((row) => row.module.startsWith("StoryObjects.")).map((row) => row.module.split(".")[1]))],
    affectedRelationships: [...new Set(items.filter((row) => row.module.startsWith("RelationshipHistory")).map((row) => row.module))],
    downstreamImpact: items.some((row) => row.category === "TRUE_CONTENT_BLOCKER")
      ? "若不补，下一层必须自行发明关键故事事实。"
      : "可通过结构化、确定性 projection 或质量整理完成，不应触发新故事创作。",
    categories: [...new Set(items.map((row) => row.category))],
  };
});

const result = {
  source: source.source,
  generatedAt: new Date().toISOString(),
  originalCheckCount: source.rowCount,
  classificationSummary: summary,
  canonContentBlockerCount: summary.TRUE_CONTENT_BLOCKER,
  goldStoryQuestionCount: questions.filter((item) => item.categories.includes("TRUE_CONTENT_BLOCKER")).length,
  structuralReadyUnderCurrentContract: source.currentContractValidation.ok,
  contentReady: summary.TRUE_CONTENT_BLOCKER === 0 && summary.QUALITY_MAJOR === 0,
  rows: reclassified,
  goldStoryQuestions: questions,
  authoringPlan: [
    { pass: "PASS 1 — CORE HISTORICAL TRUTH", questions: ["GQ01", "GQ02", "GQ03", "GQ04"] },
    { pass: "PASS 2 — CHARACTER CAUSALITY", questions: ["GQ05"] },
    { pass: "PASS 3 — RELATIONSHIP + OBJECT HISTORY", questions: ["GQ02", "GQ06"] },
    { pass: "PASS 4 — REVEAL + PAYOFF", questions: ["GQ07"] },
  ],
  providerCalls: 0,
};

fs.writeFileSync(path.join(DIR, "canon-gap-reclassification.json"), JSON.stringify(result, null, 2) + "\n", "utf8");
const md = [
  "# Auction Night｜Canon Gap Reclassification",
  "",
  "## Verdict",
  "",
  "- Original checks: " + result.originalCheckCount,
  "- TRUE_CONTENT_BLOCKER: " + summary.TRUE_CONTENT_BLOCKER,
  "- STRUCTURALIZATION_REQUIRED: " + summary.STRUCTURALIZATION_REQUIRED,
  "- DETERMINISTIC_DERIVABLE: " + summary.DETERMINISTIC_DERIVABLE,
  "- QUALITY_MAJOR: " + summary.QUALITY_MAJOR,
  "- QUALITY_MINOR: " + summary.QUALITY_MINOR,
  "- PASS: " + summary.PASS,
  "- Provider calls: 0",
  "",
  "## Gold Story Questions",
  "",
  ...questions.map((question) => [
    "### " + question.storyQuestionId + "｜" + question.title,
    "- Authoring pass: " + question.pass,
    "- Description: " + question.description,
    "- Categories: " + question.categories.join(", "),
    "- Affected checks: " + question.affectedChecks.length,
    "- Downstream impact: " + question.downstreamImpact,
  ].join("\n")),
  "",
  "## Four-pass plan",
  "",
  ...result.authoringPlan.map((item) => "- " + item.pass + " → " + item.questions.join(", ")),
  "",
  "## Reclassified rows",
  "",
  "| Module | Required | Category | Story Question | Missing |",
  "| --- | --- | --- | --- | --- |",
  ...reclassified.map((row) => "| " + [row.module, row.required, row.category, row.storyQuestionId, row.missing || "—"].map((value) => String(value).replace(/\\|/g, "\\\\|").replace(/\\n/g, " ")).join(" | ") + " |"),
  "",
  "## Decision",
  "",
  "不能把原始 blocker 数量直接当作创作任务数量。先解决 TRUE_CONTENT_BLOCKER；结构化和确定性推导不得调用 Provider。",
].join("\n") + "\n";
fs.writeFileSync(path.join(DIR, "canon-gap-reclassification.md"), md, "utf8");
console.log(JSON.stringify({
  report: path.relative(ROOT, path.join(DIR, "canon-gap-reclassification.md")),
  json: path.relative(ROOT, path.join(DIR, "canon-gap-reclassification.json")),
  originalCheckCount: result.originalCheckCount,
  classificationSummary: summary,
  goldStoryQuestionCount: result.goldStoryQuestionCount,
  providerCalls: 0,
}, null, 2));
