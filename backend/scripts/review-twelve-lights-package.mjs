/** External editorial red-team for 《十二盏灯》. */
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

const root = join(repoRoot, "examples", "pending-review", "十二盏灯");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(dir, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const selected = walk(root).filter((file) => (
  file.endsWith(".md") || file.endsWith("story-contract.json")
));
const documents = Object.fromEntries(selected.map((file) => [
  relative(root, file).replaceAll("\\", "/"),
  readFileSync(file, "utf8"),
]));

const system = `你是一名严苛的商业剧本杀终审编辑、主持人和盲测设计师。你收到一部原创六人社会派还原机制本的完整开发包。
不要复述梗概，不要用“主题深刻、设定新颖”等空泛称赞。不要因为它有社会议题就提高分数。
重点拆穿：观点角色、作者借人物说教、为了主题强行巧合、线索直接念答案、信息泄漏、时间年龄矛盾、主持无法执行、机制存在显然最优解、角色收益不对称、终局以签责冒充成长、把平均分配写成正确答案。
不建议加入凶手、隐藏资金、失忆、隐藏血缘、AI觉醒、万能NPC、终幕新证据或作者指定真结局。
只输出严格JSON。`;

const user = `以下是完整剧本包：${JSON.stringify(documents)}

请执行一次发行前红队审查，输出：
- verdict: human_table_ready / revise_then_table / rebuild
- score: 0-100
- oneSentenceFailureRisk: 如果真人桌失败，最可能因为什么
- logicIssues: 最多10项，每项含severity、files、evidence、whyItBreaks、exactRepair
- roleAudit: R1-R6，每项含humanity、distinctVoice、agency、selfInterest、relationshipPressure、weakestBeat、repair；请指出最像作者观点工具人的角色
- informationAudit: 检查每幕玩家是否提前知道后幕或他人私有事实，列出具体文件和原句；没有则空
- clueAudit: F1-F8 分别评估是否可推断、是否双来源真正独立、是否有答案型线索、扣留后是否仍能玩
- mechanismAudit: 匿名第一灯、揭名读回、签责改投、第二灯、六类结局；检查支配策略、囤灯、过度集中、互保串谋、平均分配的作者诱导、主持负担
- narrativeAudit: 文风是否真人化，哪些句子像口播/AI金句，哪些共同记忆缺少生活交叉，最多引用12处短句
- hostAudit: 新主持能否只靠手册开桌，列出缺页、模糊裁定、时间压力与防冷场问题
- mustFixBeforeHumanTable: 最多8项，必须是首桌前真正要改的
- preserve: 最多8项，不要在修订中破坏
- humanTableQuestions: 只能真人验证的6个问题
- confidence: 0到1`;

const result = await requestDeepseekJson(
  [{ role: "system", content: system }, { role: "user", content: user }],
  {
    maxTokens: 14000,
    temperature: 0.12,
    timeoutMs: 300000,
    phase: "twelve_lights_package_review_v1",
    retryOnJsonParse: true,
    transportRetries: 2,
  },
);

console.log(JSON.stringify({ model: result.model, usage: result.usage, ...result.value }, null, 2));
