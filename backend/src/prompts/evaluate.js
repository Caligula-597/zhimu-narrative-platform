import { PRODUCT_BOUNDARY, compactProposal, compactRoleMatrix, cleanText, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import { HUMAN_REVIEW_BLOCK } from "./human-authorship.js";
import { SOURCE_ADAPTATION_REVIEW_BLOCK } from "./source-adaptation-fidelity.js";

const LAYER_LABELS = {
  setup: "创作立项",
  spec: "创作立项",
  narrative: "逐章总剧情",
  roles: "角色私人本",
  roleMatrix: "角色私人本",
  matrix: "角色私人本",
  section: "角色私人本",
  sync: "汇总同步",
  structure: "汇总同步",
  evaluate: "AI 评判"
};

export function buildStoryEvaluationMessages(pipeline) {
  const setting = pipeline.setting;
  const synopsis = pipeline.synopsis;
  const brief = pipeline.brief || {};
  const authorStyle = {
    title: cleanText(brief.title, 120),
    premise: cleanText(brief.premise, 12000),
    conflicts: cleanText(brief.conflicts || brief.requirements, 2000),
    wordsPerChapter: brief.wordsPerChapter,
    chapterCount: brief.chapterCount,
    style: cleanText(brief.style, 800)
  };
  const narrativeSample = (pipeline.narrativeChapters || []).slice(0, 3).map((ch) => ({
    chapterKey: ch.chapterKey,
    title: ch.title,
    summary: cleanText(ch.summary, 300),
    bodyPreview: cleanText(ch.narrativeBody, 800)
  }));
  const rolesMeta = pipeline.rolesMeta || pipeline.roleMatrix;
  const system = `你是资深线上剧本杀质检编辑与改稿顾问。你只做评判与修改指导，不重写完整正文。

${PRODUCT_BOUNDARY}

${HUMAN_REVIEW_BLOCK}

${SOURCE_ADAPTATION_REVIEW_BLOCK}

【核心任务】
1. 打分并指出问题。
2. 给出**可执行的修改方向**：每条必须对应流水线某一层，方便作者「回到该层重新生成」。
3. 结合**创作设定**与**剧情纲要**评判，不要改成与作者意图无关的通用模板。

【评判维度】（每项 1-10）
playability 可玩性 · fairness 公平推理 · multiRoleDesign 多人设计 · pacing 章节节奏 · graphReady 编排可落地 · consistency 内部一致 · styleFit 风格契合 · humanAuthorship 真人作者感 · sourceFidelity 原素材忠实度 · subtext 潜台词与留白 · voiceDistinctness 角色声线差异 · dramaticTension 戏剧张力

humanAuthorship 不是查“不禁、缓缓”等词频，而是判断故事是否命题先行、人物是否只是观点席位、生活是否被过度象征化。严重结构性 AI 母体必须产生 high issue + setup/narrative 的 must_fix，不得只建议润色。
sourceFidelity 不是检查是否出现了相同名词，而是判断原素材的思考顺序、不可合并矛盾、权力翻转和延迟后果是否全部进入人物命运。出现 semantic_substitution 或 high_loss_compression 时不得通过。
dramaticTension 不等于争吵激烈：必须有人能以主动行为获利并让别人立即受损，受损者拥有可执行反制。连续依赖协商、表态、共同投票和平均分配时不得超过 4 分。fairness 只审规则、信息与反制机会，不得拿来要求收益和结局对称。

【修改方向要求】
- revisions 至少 3 条（有问题时），按 priority 排序：must_fix > should_fix > optional
- targetLayer 只能是：setup | narrative | roles | sync | evaluate
- targetKey：可选，如 ch2、role-1、scene-3；narrative 层写 chapterKey
- direction：具体改什么、为什么（50～200 字）
- promptHint：作者下一轮可粘贴进「额外的矛盾冲突」或对应层重生成用的**中文提示语**
- preserve：应保留的优点

【输出 schema】
{
  "overallScore": 7.5,
  "verdict": "一句话总评",
  "scores": {
    "playability": 8, "fairness": 7, "multiRoleDesign": 8,
    "pacing": 7, "graphReady": 8, "consistency": 7, "styleFit": 8,
    "humanAuthorship": 6, "sourceFidelity": 5, "subtext": 6, "voiceDistinctness": 7, "dramaticTension": 5
  },
  "sourceFidelityAudit": {
    "verdict": "preserved|partial|semantic_substitution|source_truncated|not_applicable",
    "preservedConflictAnchors": ["被行动与后果承载的原素材矛盾"],
    "missingConflictAnchors": ["被删除或降为台词的矛盾"],
    "substitutions": ["用什么相邻主题、强意象或新故事替换了原素材"],
    "causalBreaks": ["哪一段思考推进或权力反转断裂"]
  },
  "styleAlignment": {
    "matchLevel": "high|medium|low",
    "summary": "与作者创作设定的契合说明",
    "keepEmphasis": ["应强化的方向"],
    "adjustEmphasis": ["微调建议"]
  },
  "strengths": ["优点"],
  "issues": [{"severity":"high|medium|low","area":"维度","detail":"问题"}],
  "revisions": [{
    "targetLayer": "narrative",
    "targetKey": "ch2",
    "priority": "must_fix|should_fix|optional",
    "problem": "问题简述",
    "direction": "修改方向",
    "promptHint": "下轮生成用提示语",
    "preserve": "应保留的元素"
  }],
  "nextStepOrder": ["narrative","roles","sync"],
  "readyForImport": false
}
nextStepOrder：建议重生成顺序（layer 名数组，2～5 项）。
readyForImport：overallScore>=7、无 high severity、styleFit>=6、humanAuthorship>=7、sourceFidelity>=7、subtext>=6、voiceDistinctness>=7、dramaticTension>=7，sourceFidelityAudit 不为 partial/semantic_substitution/source_truncated，且无 must_fix 时为 true。`;
  const sampleSections = Object.entries(pipeline.sections || {}).flatMap(([roleKey, chapters]) =>
    Object.entries(chapters || {}).map(([chapterKey, section]) => ({
      roleKey,
      chapterKey,
      title: section.title,
      bodyPreview: cleanText(section.body, 400)
    }))
  ).slice(0, 3);
  const creativeBlock = setting && synopsis
    ? creativeInputUserBlocks(setting, synopsis)
    : untrustedUserPayload("创作设定", authorStyle);
  const user = `请质检并给出修改方向。务必结合作者主题、剧情纲要、矛盾冲突，不要建议背离创作设定的改动。

${creativeBlock}
${pipeline.config || pipeline.spec ? untrustedUserPayload("编排配置", pipeline.config || pipeline.spec) : ""}
${narrativeSample.length ? untrustedUserPayload("章节总剧情样本", narrativeSample) : ""}
${pipeline.proposal ? untrustedUserPayload("编排结构", compactProposal(pipeline.proposal)) : ""}
${rolesMeta ? untrustedUserPayload("角色清单", compactRoleMatrix(rolesMeta)) : ""}
${pipeline.sampleSection ? untrustedUserPayload("分幕样本", { roleKey: pipeline.sampleSection.roleKey, chapterKey: pipeline.sampleSection.chapterKey, title: pipeline.sampleSection.title, bodyPreview: cleanText(pipeline.sampleSection.body, 600) }) : ""}
${sampleSections.length ? untrustedUserPayload("已生成分幕", sampleSections) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export { LAYER_LABELS };
