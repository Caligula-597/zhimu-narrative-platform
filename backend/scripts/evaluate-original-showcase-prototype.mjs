/** Simulate and adjudicate the isolated playable prototype for 《未归还》. */
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

const prototypeRoot = join(
  repoRoot,
  "examples",
  "pending-review",
  "未归还",
  "prototype-v1"
);

const contract = JSON.parse(readFileSync(join(prototypeRoot, "prototype-contract.json"), "utf8"));
const documentPaths = [
  ...contract.documents.host,
  ...contract.documents.evidence,
  ...contract.documents.roles
];
const documents = Object.fromEntries(documentPaths.map((relativePath) => [
  relativePath,
  readFileSync(join(prototypeRoot, relativePath), "utf8")
]));

const system = `你是线下互动叙事的模拟试玩导演。输入是一个全新原创、四人、三幕、非凶案项目的完整V1原型。
你必须把玩家当成首次接触材料的人，不得使用旧项目、外部作品或输入之外的知识补谜底。
模拟时遵守持有人、幕次和来源公开规则；私人记忆不算公共证据；拒绝是合法选择；主持不能替玩家揭露或代签。
不要因为作者希望精品就客气。区分“结构上能跑”和“玩家实际会自然这样做”。输出严格JSON。`;

const simulationPrompt = `以下是原型合同和全部试玩材料。

合同：${JSON.stringify(contract)}

材料：${JSON.stringify(documents)}

请进行三桌压缩模拟，每桌都记录A1/A2/A3的关键行为，不写长篇小说式对话：

TABLE-1 合作但不读作者心：四名玩家愿意交换，但会保护角色利益；每幕至少有人先扣住一张不利材料。
TABLE-2 防御与拒绝：何溪第一幕拒绝确认箱子；沈闻川23:20选择“无来源争议”；周慕把E09扣到第二幕末。检查游戏是否仍有推理、冲突和可信结局。
TABLE-3 冲动传播：周慕从开场就追求原始公开；何溪想给外祖母正名但看见授权后可能转变；其他两人优先保馆与资金。检查END-C是不是自然风险而非作者说教。

每桌输出：
- actTrace: A1/A2/A3各列公开来源、关键决定、玩家自然会追问的问题、可能卡点
- verifiedFacts: 最终F1-F6哪些满足门槛
- finalActions: R1-R4实际动作
- ending: 按C>B>A>D判定并解释，不得迎合最好结局
- spotlight: R1-R4各自一次不可替代贡献或缺席
- playerExperience: 最可能兴奋、困惑、防御、后悔的时刻
- hostInterventions: 必需且规则允许的提示

然后输出：
- metricScores: onboardingClarity、mysteryFairness、evidenceComprehension、agencyBalance、emotionalCredibility、tempo、endingCausality、consentClarity、replayDiversity，均为1-10整数并给一句依据
- crossTableFindings: 至少3项跨桌稳定优点与3项稳定风险
- blockers: 只有不修就不应真人试玩的硬伤
- targetedRepairs: 最多10项，必须指向具体文件/段落/卡片，说明keep/change/cut，禁止建议新增万能证据或NPC
- verdict: ready_for_human_table / revise_then_human_table / rebuild`;

const simulation = await requestDeepseekJson(
  [{ role: "system", content: system }, { role: "user", content: simulationPrompt }],
  {
    maxTokens: 16000,
    temperature: 0.32,
    timeoutMs: 240000,
    phase: "original_showcase_prototype_simulation_v1",
    retryOnJsonParse: true,
    transportRetries: 2
  }
);

const judgeSystem = `你是互动叙事原型的独立审稿人。你会看到V1合同、全部材料和另一名模拟试玩导演的报告。
你不能只复述报告，必须核对具体文本和结算规则。对每个问题标注confirmed、partly_confirmed或rejected。
优先抓：玩家需要作者视角才会做出的行为、证据过强/过弱、角色权力假平衡、计时门槛不清、主持越权、结局说教、文书阅读过载。
禁止引入新凶案、万能NPC、隐藏亲缘、终幕新证据。输出严格JSON。`;

const judgePrompt = `原型合同：${JSON.stringify(contract)}

全部材料：${JSON.stringify(documents)}

模拟试玩报告：${JSON.stringify(simulation.value)}

请输出：
- simulationAudit: 逐条核验报告中的blockers和targetedRepairs，含status、evidence、decision
- independentFindings: 模拟报告遗漏的具体问题
- roleScorecard: R1-R4的informationLeverage、decisionLeverage、emotionalCost、actOneInitiative，各1-10并解释
- actScorecard: A1-A3的clarity、tension、readingLoad、choiceDensity，各1-10并解释
- evidenceAudit: P01-P08逐包列tooStrong/tooWeak/redundant/clear及一句理由
- endingAudit: A-D逐结局列causal、costReadable、moralizingRisk及修订建议
- mustFixBeforeHuman: 最多6项，按优先级，具体到文件
- safeToDefer: 真人首测后再处理的问题
- finalVerdict: ready_for_human_table / revise_then_human_table / rebuild
- confidence: 0到1`;

const judge = await requestDeepseekJson(
  [{ role: "system", content: judgeSystem }, { role: "user", content: judgePrompt }],
  {
    maxTokens: 16000,
    temperature: 0.16,
    timeoutMs: 240000,
    phase: "original_showcase_prototype_judge_v1",
    retryOnJsonParse: true,
    transportRetries: 2
  }
);

console.log(JSON.stringify({
  simulation: {
    model: simulation.model,
    usage: simulation.usage,
    report: simulation.value
  },
  judge: {
    model: judge.model,
    usage: judge.usage,
    report: judge.value
  }
}, null, 2));
