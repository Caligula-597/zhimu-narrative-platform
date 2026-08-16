/** Red-team the complete, isolated story package for 《未归还》. */
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

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(dir, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const documents = Object.fromEntries(
  walk(packageRoot)
    .filter((file) => file.endsWith(".md") || file.endsWith(".json"))
    .map((file) => [relative(packageRoot, file).replaceAll("\\", "/"), readFileSync(file, "utf8")])
);

const system = `你是互动叙事完整包的终审红队。输入只包含一个全新原创、4人、3幕、非凶案项目。
不得引用其他作品，不得建议新增凶手、万能NPC、隐藏亲缘、失忆、终幕新证据或用现实法律替代故事合同。
必须按具体文件和线索ID审查，不因材料多就泛泛称赞。输出严格JSON。`;

const user = `完整剧情包：${JSON.stringify(documents)}

请做以下压力测试：
1. 世界因果：第17箱为何属于公共保管、为何能被带走25年、四人为何必须今夜在场、午夜期限是否可信。
2. 人物因果：逐R1-R4检查“为什么不早点说/交/改”、今夜目标、秘密、线索与终局权力是否相互支持。
3. 分幕门禁：逐角色检查00/01/02/03是否提前泄露其他人或后幕答案，是否每幕都有可执行动作。
4. 线索审计：逐E01-E12判断来源链、独立性、证明强度、是否自证或过强；核对F1-F6能否按合同推出。
5. 结局穷举思维：重点检查Z3但非H4、A+H2、A+H3、B缺F1/F2/F6、23:20资格关闭后S2等组合。
6. 情绪与节奏：是否会变成读档案考试，哪个角色最可能陪衬，哪一幕最拥堵，结局文本是否评判玩家。
7. 图谱一致性：四张maps是否与主持、角色、线索及合同冲突。

输出字段：
- verdict: ready_for_human_table / revise_then_human_table / rebuild
- hardBlockers: 不修就不能开真人桌的问题
- worldLogicAudit: ownership、longCustody、attendance、deadline，各含status/evidence/problem/repair
- roleAudit: R1-R4，各含causalStrength、whyNotEarlier、actAgency、leakage、risk、repair
- clueAudit: E01-E12，各含sourceCredibility、independence、strength、issue、repair
- factAudit: F1-F6，各含derivable、missingLink、overproofRisk
- endingAudit: C/B/A/D与上述边界组合，逐项列deterministic/contradiction/repair
- pacingAudit: A1/A2/A3的readingLoad、decisionDensity、likelyStall、repair
- mapAudit: flow、facts、relationships、endings，一致性问题
- mustFix: 按优先级最多8项，具体到文件和段落
- safeToDefer: 只能留给真人桌回答的问题
- confidence: 0到1`;

const result = await requestDeepseekJson(
  [{ role: "system", content: system }, { role: "user", content: user }],
  {
    maxTokens: 18000,
    temperature: 0.12,
    timeoutMs: 240000,
    phase: "original_showcase_complete_package_review_v1",
    retryOnJsonParse: true,
    transportRetries: 2
  }
);

console.log(JSON.stringify({ model: result.model, usage: result.usage, ...result.value }, null, 2));
