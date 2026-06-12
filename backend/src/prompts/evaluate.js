import { PRODUCT_BOUNDARY, compactOutline, compactProposal, compactRoleMatrix, cleanText, untrustedUserPayload } from "./shared.js";

const LAYER_LABELS = {
  spec: "创作设定",
  outline: "总纲",
  narrative: "章节总剧情",
  structure: "编排结构",
  roleMatrix: "角色矩阵",
  matrix: "角色矩阵",
  section: "私人分幕",
  synopsis: "短母稿"
};

export function buildStoryEvaluationMessages(pipeline) {
  const brief = pipeline.brief || {};
  const authorStyle = {
    title: cleanText(brief.title, 120),
    premise: cleanText(brief.premise, 2000),
    conflicts: cleanText(brief.conflicts || brief.requirements, 2000),
    wordsPerChapter: brief.wordsPerChapter,
    chapterCount: brief.chapterCount,
    style: cleanText(brief.style, 800)
  };
  const narrativeSample = (pipeline.narrativeChapters || []).slice(0, 3).map((ch) => ({
    chapterKey: ch.chapterKey,
    title: ch.title,
    summary: cleanText(ch.summary, 300),
    bodyPreview: cleanText(ch.narrativeBody, 600)
  }));
  const system = `你是资深线上剧本杀质检编辑与改稿顾问。你只做评判与修改指导，不重写完整正文。

${PRODUCT_BOUNDARY}

【核心任务】
1. 打分并指出问题。
2. 给出**可执行的修改方向**：每条必须对应流水线某一层，方便作者「回到该层重新生成」。
3. 结合**作者创作设定**（主题、剧情纲要、矛盾冲突）评判，不要改成与作者意图无关的通用模板。

【评判维度】（每项 1-10）
playability 可玩性 · fairness 公平推理 · multiRoleDesign 多人设计 · pacing 章节节奏 · graphReady 编排可落地 · consistency 内部一致 · styleFit 风格契合

【修改方向要求】
- revisions 至少 3 条（有问题时），按 priority 排序：must_fix > should_fix > optional
- targetLayer 只能是：spec | outline | narrative | structure | roleMatrix | section | synopsis
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
    "pacing": 7, "graphReady": 8, "consistency": 7, "styleFit": 8
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
  "nextStepOrder": ["outline","narrative","structure"],
  "readyForImport": false
}
nextStepOrder：建议重生成顺序（layer 名数组，2～5 项）。
readyForImport：overallScore>=7、无 high severity、styleFit>=6 且无 must_fix 时为 true。`;
  const sampleSections = Object.entries(pipeline.sections || {}).flatMap(([roleKey, chapters]) =>
    Object.entries(chapters || {}).map(([chapterKey, section]) => ({
      roleKey,
      chapterKey,
      title: section.title,
      bodyPreview: cleanText(section.body, 400)
    }))
  ).slice(0, 2);
  const user = `请质检并给出修改方向。务必结合作者主题、剧情纲要、矛盾冲突，不要建议背离创作设定的改动。

${untrustedUserPayload("创作设定", authorStyle)}
${pipeline.spec ? untrustedUserPayload("规格（系统推导）", pipeline.spec) : ""}
${pipeline.outline ? untrustedUserPayload("总纲", compactOutline(pipeline.outline)) : ""}
${narrativeSample.length ? untrustedUserPayload("章节总剧情样本", narrativeSample) : ""}
${pipeline.proposal ? untrustedUserPayload("编排结构", compactProposal(pipeline.proposal)) : ""}
${pipeline.roleMatrix ? untrustedUserPayload("角色矩阵", compactRoleMatrix(pipeline.roleMatrix)) : ""}
${pipeline.synopsis ? untrustedUserPayload("短母稿", { title: pipeline.synopsis.title, summary: pipeline.synopsis.summary, overallManuscript: cleanText(pipeline.synopsis.overallManuscript, 1200), logicNotes: pipeline.synopsis.logicNotes }) : ""}
${pipeline.sampleSection ? untrustedUserPayload("分幕样本", { roleKey: pipeline.sampleSection.roleKey, chapterKey: pipeline.sampleSection.chapterKey, title: pipeline.sampleSection.title, bodyPreview: cleanText(pipeline.sampleSection.body, 600) }) : ""}
${sampleSections.length ? untrustedUserPayload("已生成分幕", sampleSections) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export { LAYER_LABELS };
