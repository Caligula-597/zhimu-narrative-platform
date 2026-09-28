/**
 * Final human-facing playability review for Auction Night Integrated Story
 * Gold. No new contract, no Writer, no Runtime, no automatic Canon promotion.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(ROOT, "captures", "integrated-story-gold", "auction-night-v1", "integrated-story-gold.json");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const gold = source.gold;

const roleReview = [
  {
    roleId: "A",
    act1Want: "拿到玉蝉，或至少确认它是否真能保存一段身份记录。",
    privateReason: "不能公开自己为何知道玉蝉的重要性。",
    observableAnomaly: "对玉蝉持续抬价，宁愿牺牲后续筹码也不让它落入 D 手中。",
    act2Reinterpretation: "高价不再只是长生执念，也可能是在抢救被篡改的前世记录。",
    needsInAct3: "需要 C 解释残卷位置，或需要 B 手里的验证资源。",
    deceptionRisk: "G 可以用错误的身份片段让 A 误以为自己正在保护敌方记录。",
    act4Sacrifice: "公开自己为何必须保护玉蝉，或消耗玉蝉保存能力。",
  },
  {
    roleId: "B",
    act1Want: "尽可能拿下三件以上拍品，控制最多的可交换资源。",
    privateReason: "必须证明自己不是任何阵营的工具，但不能承认自己在收集验证能力。",
    observableAnomaly: "对表面价值低的器物也会出价，像收藏家却总在计算别人会失去什么。",
    act2Reinterpretation: "最像旁观者的人突然拥有最多后期能力，所有人都需要重新评估 B。",
    needsInAct3: "需要其他人提供身份解释，别人则需要 B 的器物和筹码。",
    deceptionRisk: "G 可以用假估值诱导 B 把关键器物换给错误对象。",
    act4Sacrifice: "放弃资源控制权，公开一项自己一直保留的器物用途。",
  },
  {
    roleId: "C",
    act1Want: "确保至少一件能打开或读取案卷的器物进入自己可接触的范围。",
    privateReason: "不能公开案卷来源，否则会让焚卷一脉先锁定破坏目标。",
    observableAnomaly: "不一定争最高价，却会极力阻止关键器物被某几个人拿走。",
    act2Reinterpretation: "看似在操纵拍卖方向，实际是在保护案卷复原的入口。",
    needsInAct3: "需要 E 重构器物关系，也需要 B 或 A 提供具体验证能力。",
    deceptionRisk: "G 可以让 C 追逐一条被植入的伪案卷路径。",
    act4Sacrifice: "公开案卷来源，换取真实对应关系被保留下来。",
  },
  {
    roleId: "D",
    act1Want: "阻止指定器物落入指定人物手中。",
    privateReason: "委托对象和禁止条件都不能公开。",
    observableAnomaly: "在某些拍品上表现得不像买家，而像在执行阻断任务。",
    act2Reinterpretation: "D 的强硬行为可能是世家委托，也可能是在替篡改者清理资源。",
    needsInAct3: "需要 C 的案卷权限解释，或必须向 A/B 交换一次资源。",
    deceptionRisk: "A 可以利用 D 的禁止条件反过来抬价逼出委托目的。",
    act4Sacrifice: "放弃委托的器物目标，公开自己真正保护的是谁。",
  },
  {
    roleId: "E",
    act1Want: "确认一件器物是否与自己的私人历史有关。",
    privateReason: "不能承认自己过去接触过原件。",
    observableAnomaly: "对某件器物的细节反应过快，或在关键竞价时刻故意退让。",
    act2Reinterpretation: "E 确实做过可疑行为，但行为的真实目的不等于案卷给出的解释。",
    needsInAct3: "需要 F 的行为核对，也需要 C 或 B 提供残卷位置。",
    deceptionRisk: "F 会被真实行为牵着走；G 则利用这条真行为制造错误嫌疑。",
    act4Sacrifice: "公开自己的真实行为，换取别人接受‘行为真实、解释错误’。",
  },
  {
    roleId: "F",
    act1Want: "找到今晚一定会动手的幕后操作者。",
    privateReason: "不能公开自己为何提前知道会有人动手。",
    observableAnomaly: "不只看拍品，而是持续记录谁在推动价格、谁在回避案卷封条。",
    act2Reinterpretation: "F 的证据链大部分是真的，但关键指向可能被 G 提前改过。",
    needsInAct3: "需要 E 的真实行为细节和 C 的案卷结构，才能拆开行为与解释。",
    deceptionRisk: "G 让 F 成为错误指认的发动机，而不是直接伪造全部证据。",
    act4Sacrifice: "承认自己曾经错误限制 E，放弃调查权威换取真实版本留下。",
  },
  {
    roleId: "G",
    act1Want: "让关键错误身份对应在终局前保持有效。",
    privateReason: "不能让任何人知道自己提前改过案卷。",
    observableAnomaly: "表面维持拍卖秩序，却会微调拍品顺序、解释口径和可见信息。",
    act2Reinterpretation: "看似中立的主持行为，实际在给某些器物和身份争取错误的先手。",
    needsInAct3: "需要利用 F 的怀疑、D 的委托和 B 的资源，而不能单独完成计划。",
    deceptionRisk: "G 可以让真实行为与错误解释同时存在，使所有人互相验证、互相误伤。",
    act4Sacrifice: "牺牲一段伪造对应，换取核心错误版本继续存活；不能同时保住全部谎言。",
  },
];

const resourcePressure = [
  "关键器物的目标集合不能被同一玩家全部买齐；拿下玉蝉会显著减少后续铜镜/古印的机会。",
  "故意抬价会真实消耗后续能力资源；卡住对手不是无成本的社交动作。",
  "放弃拍品会保留筹码，但关键能力可能落入别人手中，形成不可逆的后续依赖。",
  "B 即使拥有最多资源，也必须在公开控制力与隐藏阵营之间做取舍，不能无代价覆盖全部需求。",
];

const questionEvolution = [
  ["Act 1 开始", "我要拿到我想要的拍品。"],
  ["Act 1 结束", "为什么这些人也在争这些东西？我刚才的出价暴露了什么？"],
  ["Act 2 结束", "前面的竞价是在争收藏品，还是他们早就知道器物的真正用途？"],
  ["Act 3 结束", "我知道案卷被动过，但现在还能相信谁对自己的行为解释？"],
  ["Act 4", "我必须现在保护谁、牺牲什么、留下哪部分可证明的真相？"],
];

const localSkillChecks = gold.identityFactionGraph.roles.map((role) => ({
  roleId: role.roleId,
  skill: role.roleSkill,
  localQuestion: role.roleSkill,
  forbiddenShortcut: /是坏人|是反派|属于[^，。；]*阵营|阵营身份已确定|确定是好人/.test(role.roleSkill) ? "FAIL" : "PASS",
}));

const issues = [];
if (roleReview.length !== 7) issues.push("ROLE_REVIEW_COUNT");
for (const row of roleReview) {
  for (const [key, value] of Object.entries(row)) if (!value) issues.push(`ROLE_FIELD:${row.roleId}:${key}`);
}
if (gold.artifactUtilityMap.some((artifact) => !artifact.persistsAcrossPhases)) issues.push("ARTIFACT_NOT_PERSISTENT");
if (gold.identityFactionGraph.links.length < 8) issues.push("RELATION_GRAPH_THIN");
if (localSkillChecks.some((item) => item.forbiddenShortcut === "FAIL")) issues.push("SKILL_ANSWER_MACHINE");
if (resourcePressure.length < 3) issues.push("RESOURCE_PRESSURE_THIN");
if (new Set(questionEvolution.map(([, question]) => question)).size !== questionEvolution.length) issues.push("PLAYER_QUESTION_REPEATS");

const report = {
  code: issues.length ? "PRE_CANON_PLAYABILITY_REVIEW" : "PRE_CANON_PLAYABILITY_PASS",
  canonRecommendation: issues.length === 0 ? "HUMAN_DECISION_REQUIRED" : "DO_NOT_PROMOTE",
  issues,
  roleReview,
  resourcePressure,
  questionEvolution,
  localSkillChecks,
  source: sourcePath,
};

function render(value) {
  const lines = [
    "# Auction Night V1 · Pre-Canon Playability Review",
    "",
    "> DESIGN_ONLY：这是升 Canon 前的人工审查表，不会自动修改 Canon 状态，也不进入 Writer。",
    "",
    `**结果：** ${value.code} · **Canon：${value.canonRecommendation}**`,
    "",
    "## 7 人首幕主动性与后续回收",
    "",
    "| 角色 | Act 1 想要什么 | 不能公开的理由 | 可观察异常行为 | Act 2 重解释 | Act 3 需要谁 | 能骗谁/被谁误导 | Act 4 牺牲什么 |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const row of value.roleReview) {
    lines.push(`| ${row.roleId} | ${row.act1Want} | ${row.privateReason} | ${row.observableAnomaly} | ${row.act2Reinterpretation} | ${row.needsInAct3} | ${row.deceptionRisk} | ${row.act4Sacrifice} |`);
  }
  lines.push("", "## 技能局部性检查", "", "| 角色 | 技能 | 回答的局部问题 | 是否变成身份答案机 |", "|---|---|---|---|");
  for (const row of value.localSkillChecks) lines.push(`| ${row.roleId} | ${row.skill} | ${row.localQuestion} | ${row.forbiddenShortcut} |`);
  lines.push("", "## 拍卖资源压力", "", ...value.resourcePressure.map((item) => `- ${item}`));
  lines.push("", "## 玩家问题演化", "", "| 阶段 | 玩家此刻真正想知道什么 |", "|---|---|");
  for (const [phase, question] of value.questionEvolution) lines.push(`| ${phase} | ${question} |`);
  lines.push("", "## 当前审查项", "", ...value.issues.map((issue) => `- ${issue}`));
  return lines.join("\n");
}

const out = path.join(ROOT, "captures", "integrated-story-gold", "auction-night-v1");
fs.writeFileSync(path.join(out, "pre-canon-playability-review.md"), `${render(report)}\n`, "utf8");
fs.writeFileSync(path.join(out, "pre-canon-playability-review.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ code: report.code, canonRecommendation: report.canonRecommendation, issues: report.issues.length, roles: report.roleReview.length, questionStages: report.questionEvolution.length }, null, 2));
