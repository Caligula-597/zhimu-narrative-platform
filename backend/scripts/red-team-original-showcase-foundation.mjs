/** Red-team the isolated structured foundation for 《未归还》. */
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

const contract = JSON.parse(readFileSync(
  join(repoRoot, "examples", "pending-review", "未归还", "logic-contract.json"),
  "utf8"
));

const system = `你是互动叙事项目的第二轮红队。输入只有一个全新原创项目的结构化逻辑合同。
不得写正文，不得引用其他作品，不得为了显得有意见而建议增加凶案、万能NPC、隐藏亲缘、失忆或终幕新证据。
审查目标是判断这个合同能否支持4名玩家在80分钟内，通过主动交换证据和行使独占权力，得到可解释但有代价的结局。
输出必须是JSON。`;

const user = `审查以下合同：${JSON.stringify(contract)}

重点压力测试：
1. 六个事实命题是否真的能由列出的证据推出，有没有证据自证或同源伪交叉。
2. 12件证据是否在80分钟内过载，哪些可合并但不能损害双证据原则。
3. 任意一名玩家拒绝公开全部材料时，其他三人是否仍有可玩的推理与可信结局。
4. 四项终局权力是否平衡，是否有人能单方面决定一切。
5. END-B的第9.3条是否像为“好结局”临时创造的后门。
6. 四个结局是否互斥、完备，有没有明显的钻空子组合。
7. 角色现在的责任是否足以避免把问题全推给已故前人。

输出字段：
- verdict: pass_to_prototype / revise_then_prototype / rebuild / reject
- blockers: 阻止进入私人正文的硬伤
- factAudit: 逐F1-F6给出strength、problem、repair
- evidenceLoadAudit: totalAssessment、mergeCandidates、mustRemainSeparate、timingRisk
- refusalSimulations: 逐R1-R4模拟该角色全程扣住核心材料，列remainingPlayableFacts、availableEndings、failureMode、neededFallback（fallback不能新增证据）
- powerBalanceAudit: 逐角色列leverage、counterweight、balanceIssue
- endingLoopholes: 逐结局列loophole、repair
- clause93Audit: credibility、missingSetup、repair
- manuscriptGateChecklist: 进入正文前必须完成的核对清单
- conciseRepairPlan: 按优先级最多10项`;

const result = await requestDeepseekJson(
  [{ role: "system", content: system }, { role: "user", content: user }],
  {
    maxTokens: 14000,
    temperature: 0.18,
    timeoutMs: 180000,
    phase: "original_showcase_foundation_red_team_v2",
    retryOnJsonParse: true,
    transportRetries: 2
  }
);

console.log(JSON.stringify({ model: result.model, usage: result.usage, ...result.value }, null, 2));
