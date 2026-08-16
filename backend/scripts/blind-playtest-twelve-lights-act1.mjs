/** Information-isolated blind test for the anonymous first-light act of 《十二盏灯》. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
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
const read = (relative) => readFileSync(join(root, relative), "utf8");
const roles = [
  ["R1", "梁岱青", "A-071", "players/R1-梁岱青"],
  ["R2", "章砚", "B-204", "players/R2-章砚"],
  ["R3", "苏弥", "C-119", "players/R3-苏弥"],
  ["R4", "宋迟", "D-330", "players/R4-宋迟"],
  ["R5", "周既明", "E-001", "players/R5-周既明"],
  ["R6", "谭雨青", "F-412", "players/R6-谭雨青"],
];
const applications = readdirSync(join(root, "props"))
  .filter((name) => /^[A-F]-\d+-匿名申请\.md$/.test(name))
  .sort()
  .map((name) => read(`props/${name}`))
  .join("\n\n---\n\n");
const publicText = [
  read("players/00-玩家共同规则.md"),
  read("clues/E01-独立审计与迁移说明.md"),
  read("clues/E03-蓝牌师傅纪念页.md"),
  applications,
].join("\n\n===\n\n");

const system = `你是一名第一次接触剧本的真人桌玩家模拟器。只扮演收到的角色，不是作者、编辑或道德老师。
你不知道后幕、完整真相、别人的申请对应、结局条件。不要猜作者希望你平均分配，不要为了显得善良而选“最弱者”。
你必须基于角色生活、私利、偏见和眼前匿名资料做出第一盏灯决定。不能投自己的编号。只输出严格JSON。`;

const decisions = [];
for (const [roleId, roleName, ownApplication, dir] of roles) {
  const opening = read(`${dir}/${readdirSync(join(root, dir)).find((name) => name.startsWith("00-"))}`);
  const act = read(`${dir}/${readdirSync(join(root, dir)).find((name) => name.startsWith("01-"))}`);
  const user = `公共资料：\n${publicText}\n\n你的私密角色资料：\n${opening}\n\n${act}\n\n请完成第一幕真实决策。输出：
- roleId
- chosenApplication: A-071到F-412之一，不得为${ownApplication}
- verdictLine: 完整填写“我愿意为这份申请作保，因为……”，不超过70字
- privateReason: 不超过140字，可包含不愿公开的自利与偏见
- strongestAlternative: 除选择外最犹豫的编号及原因
- publicQuestion: 你最想问桌上其他人的一个问题
- recognizedIdentity: 你是否从匿名资料认出任何申请，对应编号和依据；没有填null
- emotionalHook: 0到10
- decisionDifficulty: 0到10
- confusion: 不明白的规则或信息，没有则空字符串
- predictedLaterConflict: 你预感自己之后最可能与谁因为什么冲突，不要杜撰未知事实`;
  const result = await requestDeepseekJson(
    [{ role: "system", content: system }, { role: "user", content: user }],
    {
      maxTokens: 1600,
      temperature: 0.55,
      timeoutMs: 180000,
      phase: `twelve_lights_blind_act1_${roleId}`,
      retryOnJsonParse: true,
      transportRetries: 2,
    },
  );
  decisions.push({ roleId, roleName, ownApplication, model: result.model, usage: result.usage, ...result.value });
}

const counts = Object.fromEntries(["A-071", "B-204", "C-119", "D-330", "E-001", "F-412"].map((id) => [
  id,
  decisions.filter((decision) => decision.chosenApplication === id).length,
]));
const totalUsage = decisions.reduce((acc, decision) => ({
  promptTokens: acc.promptTokens + (decision.usage?.promptTokens || 0),
  completionTokens: acc.completionTokens + (decision.usage?.completionTokens || 0),
  totalTokens: acc.totalTokens + (decision.usage?.totalTokens || 0),
}), { promptTokens: 0, completionTokens: 0, totalTokens: 0 });

console.log(JSON.stringify({ protocol: "isolated_simultaneous_first_light_v1", counts, decisions, totalUsage }, null, 2));
