/** Blind-read and red-team the long-form narrative layer for 《未归还》. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { requestDeepseekJson } from "../src/deepseek-client.js";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(backendRoot, "..");
const envPath = join(backendRoot, ".env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const packageRoot = join(repoRoot, "examples", "pending-review", "未归还", "complete-package");
const roots = ["narrative", "roles", "clues"];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(dir, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const selectedFiles = [
  join(packageRoot, "story-contract.json"),
  join(packageRoot, "host", "03-完整真相与复盘.md"),
  ...roots.flatMap((root) => walk(join(packageRoot, root)).filter((file) => file.endsWith(".md"))),
];

const documents = Object.fromEntries(selectedFiles.map((file) => [
  relative(packageRoot, file).replaceAll("\\", "/"),
  readFileSync(file, "utf8"),
]));

const system = `你是沉浸式角色剧本的终审编辑兼盲读玩家。项目是原创4人、3幕、非凶案公共记忆故事。
不要泛泛称赞，不要把线索多等同于剧情足，不要建议凶手、失忆、隐藏亲缘、万能NPC、终幕新证据或爱情线救场。
审查重点是：人物是否像活过而不是被分配任务；共同场景在多视角重复时是否产生重读；每个角色是否有不可替代的推进；叙事是否提前泄露应由线索证明的事实。输出严格JSON。`;

const user = `完整正文、行动页、线索与真相：${JSON.stringify(documents)}

请完成以下审查：
1. 分别以R1-R4玩家盲读，说明每幕“我相信什么—什么被改写—我必须做什么”，检查情感弧、错误信念、行动动力是否成立。
2. 审查C03展览、C04采访、C05追思会、C06文案会、今夜群聊的同场错位：时间、位置、原话是否一致；重复是否带来新增意义还是只复述。
3. 审查四种叙述法（编目、倒叙书信、剪辑蒙太奇、修复剥层）是否持续、清楚、不过度炫技。
4. 审查正文是否把E01-E12变成人物经历的一部分，同时仍保留线索卡的独立证明功能。
5. 搜索串词：任何角色是否提前知道别人的私有材料、后幕授权、沈启明放行、假记录动机或箱内状态；角色记忆是否被误当证据。
6. 评估节奏：开场与各幕实际阅读负荷、第二幕拥堵、终局是否像做选择而非答题。
7. 判断四名角色中谁最弱、哪两条关系最薄、哪一处巧合最像作者安排，并给出不改世界设定的精确修复。

输出字段：
- verdict: ready_for_human_table / revise_then_human_table / rebuild
- score: 0-100
- roleBlindReads: R1-R4，各含openingHook、beliefReversal、actAgency、emotionalPayoff、weakness、repair
- intersectionAudit: C03/C04/C05/C06/C11，各含consistency、addedMeaning、repetitionRisk、repair
- techniqueAudit: R1-R4，各含clarity、sustainability、gimmickRisk、repair
- clueEmbodiment: E01-E12，各含embedded、stillIndependent、issue
- leakageAudit: 列出具体文件、句子、严重度、修法；没有则空数组
- relationshipAudit: 六组关系逐项评估reciprocity、change、weakness、repair
- pacingAudit: opening/A1/A2/A3，各含estimatedReadMinutes、discussionPressure、cutOrSplit
- weakestRole: role/reason/repair
- authoredCoincidenceRisk: 最像强行安排的一处及修法
- mustFix: 最多8项，按优先级，具体到文件
- strongChoicesToPreserve: 最多8项
- humanTableQuestions: 只能靠真人桌验证的5个问题
- confidence: 0到1`;

const result = await requestDeepseekJson(
  [{ role: "system", content: system }, { role: "user", content: user }],
  {
    maxTokens: 16000,
    temperature: 0.18,
    timeoutMs: 240000,
    phase: "original_showcase_narrative_review_v1",
    retryOnJsonParse: true,
    transportRetries: 2,
  },
);

console.log(JSON.stringify({ model: result.model, usage: result.usage, ...result.value }, null, 2));
