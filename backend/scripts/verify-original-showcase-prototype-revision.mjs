/** Verify only the repaired high-risk rules for 《未归还》 prototype V1. */
import { existsSync, readFileSync } from "node:fs";
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

const prototypeRoot = join(repoRoot, "examples", "pending-review", "未归还", "prototype-v1");
const read = (relativePath) => readFileSync(join(prototypeRoot, relativePath), "utf8");

const inputs = {
  contract: JSON.parse(read("prototype-contract.json")),
  readme: read("README.md"),
  hostFlow: read("host/00-开场与场控.md"),
  settlement: read("host/01-事实核验与结算.md"),
  hexi: read("roles/R4-何溪-第一幕.md"),
  e09: read("evidence/P07-完整录音.md")
};

const system = `你是互动叙事规则验证员。只核对给出的五条高风险规则，不模拟自由剧情，不建议增加证据或NPC。
你必须逐条按文本与合同计算，不得凭“好结局/坏结局”印象作答。输出严格JSON。`;

const user = `输入：${JSON.stringify(inputs)}

请核对：
1. R4拒绝第一幕揭箱时，历史事实F2是否仍可由E01+E02核验；“今夜箱已寻回”是否保持待核。正确答案应区分这两件事。
2. E09公开时，录音和剪辑时间线能否只公开一半；规则是否无歧义。
3. F4在E05+E07+E09公开时是否满足；E05+E07单独时是否不满足。
4. R1正常签约+R2维持冠名，未触发C/B时，是否无论R4扣箱都应结算A而不是D。
5. 沈闻川23:20不答复时，主持能否代选；第9.3条资格如何处理。

对每条输出：id、expectedRule、textSupports、ambiguity、pass、remainingRepair。
再输出：
- crossRuleContradictions
- humanTableRisksOnly（只能列需要真人才能验证的节奏、理解或情绪问题）
- verdict: pass / revise / fail`;

const result = await requestDeepseekJson(
  [{ role: "system", content: system }, { role: "user", content: user }],
  {
    maxTokens: 7000,
    temperature: 0.05,
    timeoutMs: 180000,
    phase: "original_showcase_prototype_revision_verification_v1",
    retryOnJsonParse: true,
    transportRetries: 2
  }
);

console.log(JSON.stringify({ model: result.model, usage: result.usage, ...result.value }, null, 2));
