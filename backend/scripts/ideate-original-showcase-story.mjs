/**
 * One-off editorial room for a completely original showcase story.
 *
 * This script deliberately receives no existing story content. It only asks
 * DeepSeek for premise candidates; human review owns selection and canon.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { requestDeepseekJson } from "../src/deepseek-client.js";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(backendRoot, ".env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const system = `你是一间互动叙事工作室的首席策划与严厉编辑。你的工作只是提出原创立项候选，不写正文。

硬约束：
- 中文原创互动故事，4 名玩家，60–90 分钟，3 幕。
- 每名玩家都必须拥有主动目标、独占信息、可改变局势的行动，以及一个会付出代价的最终选择。
- 核心乐趣不能只是“猜中凶手”；必须同时存在可验证的事实谜题、关系冲突和价值抉择。
- 真相必须能依靠游戏内证据闭环推出，禁止超自然解释、梦境翻转、失忆万能钥匙、双胞胎替身、临终新增证据。
- 适合线上游玩，能够利用私人分幕、分阶段线索、主持确认、公开讨论、投票和多结局。
- 控制制作规模：8–12 条关键证据，2–4 个结局，不依赖大量世界观讲解。
- 不使用孤岛、灯塔、暴雪山庄、豪宅密室、列车谋杀、校园霸凌、传统遗产争夺等常见舞台。
- 不参考、改写或拼接任何已有作品或旧项目内容。

输出必须是 JSON 对象，包含 proposals 数组，恰好 8 项。每项字段：
id, workingTitle, genre, setting, playerPromise, oneSentencePremise, centralQuestion,
objectiveMystery, moralChoice, sharedPressure, roles（恰好4项，每项含function/publicGoal/privateStake/decisivePower）,
threeActEscalation（恰好3项）, evidenceEngine, endingSpace, productionRisk, originalityDefense。
另外输出 evaluationRubric，给出你认为评审这 8 项最关键的 5 个维度。`;

const user = `请生成 8 个彼此在时代、空间、职业关系和核心矛盾上显著不同的立项候选。
至少 3 个候选不以死亡案件为中心；至少 2 个发生在近未来但不依赖玄幻科技；至少 2 个扎根当代中国日常机构或城市生活。
标题应克制、易记，不要使用“迷雾、回声、深渊、终局、谜案、档案、倒计时”等生成式常用词。`;

const result = await requestDeepseekJson(
  [
    { role: "system", content: system },
    { role: "user", content: user }
  ],
  {
    maxTokens: 12000,
    temperature: 0.82,
    timeoutMs: 180000,
    phase: "original_showcase_premise_ideation",
    retryOnJsonParse: true,
    transportRetries: 2
  }
);

console.log(JSON.stringify({
  model: result.model,
  usage: result.usage,
  ...result.value
}, null, 2));
