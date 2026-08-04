import { createDeepseekStoryOutline } from "../src/deepseek.js";

if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error("DEEPSEEK_API_KEY is required; pass it through the environment");
}

const spec = {
  title: "潮汐听证会",
  playerCount: 4,
  chapterCount: 2,
  chapterKeys: ["chapter-1", "chapter-2"],
  targetWordCount: 8000,
  wordsPerSectionMin: 280,
  sceneCount: 6,
  investigationPointCount: 8,
  clueCount: 10,
  constraints: ["核心事实至少由两类独立信息印证", "结局由前序选择累计形成"],
  notes: []
};

try {
  const result = await createDeepseekStoryOutline({
    title: "潮汐听证会",
    premise: "海堤听证会开始后，四名参与者发现会场潮位表提前写出了他们尚未进行的表决结果。每次有人撤回证词，堤外一段真实水位记录就永久消失。",
    style: "近未来公共听证、工程推理与沿海社区现实主义；把质证规则转化为玩法",
    conflicts: "必须完整解释未来表决与消失水位记录，不得降级为普通剪辑骗局；核心责任由四名玩家共同承担。",
    roleRequirements: "四名玩家都要有不可替代贡献；只写真正改变状态、证据资格或他人选择的行动，禁止为了平均而逐章填空。",
    evaluationFocus: "高概念兑现、题材适配贡献、实体与资源登记、来源独立、条件失败分支、玩家到结局的因果路径、聚光分布与模板检测。",
    playerCount: 4,
    chapterCount: 2,
    spec
  });
  console.log(JSON.stringify({
    ok: true,
    model: result.model,
    attempts: result.generationAttempts,
    generationMetrics: result.generationMetrics,
    outlineRevision: result.outline.outlineRevision,
    title: result.outline.sourceFidelity.briefTitle,
    elements: result.outline.sourceFidelity.premiseElements.map((item) => item.element),
    logline: result.outline.logline,
    players: result.outline.players.length,
    chapters: result.outline.chapterBeats.length,
    entities: result.outline.entities.length,
    resources: result.outline.resources.length,
    evidence: result.outline.evidenceGraph.evidence.length,
    misdirections: result.outline.misdirections.length,
    readyForExpansion: result.outline.readiness.readyForExpansion,
    fingerprint: result.outline.batchFingerprint
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    code: error?.code || error?.name || "ERROR",
    message: error?.message || String(error),
    details: error?.details || null
  }, null, 2));
  process.exitCode = 1;
}
