import { PRODUCT_BOUNDARY, compactOutline, compactProposal, compactRoleMatrix, cleanText, untrustedUserPayload } from "./shared.js";

const LAYER_LABELS = {
  brief: "创作 brief（构想/限制）",
  spec: "规格层",
  outline: "总纲层",
  structure: "编排结构层",
  roleMatrix: "角色矩阵层",
  section: "私人分幕层",
  synopsis: "短母稿层"
};

export function buildStoryEvaluationMessages(pipeline) {
  const authorStyle = {
    style: cleanText(pipeline.brief?.style, 800),
    requirements: cleanText(pipeline.brief?.requirements, 2000),
    roleRequirements: cleanText(pipeline.brief?.roleRequirements, 2000),
    evaluationFocus: cleanText(pipeline.evaluationFocus || pipeline.brief?.evaluationFocus, 2000),
    audience: cleanText(pipeline.brief?.audience, 400)
  };
  const system = `你是资深线上剧本杀质检编辑与改稿顾问。你只做评判与修改指导，不重写完整正文。

${PRODUCT_BOUNDARY}

【核心任务】
1. 打分并指出问题。
2. 给出**可执行的修改方向**：每条必须对应流水线某一层，方便作者「回到该层重新生成」。
3. 结合**作者风格偏好**评判：不是把剧本改成通用模板，而是说明「在保持作者风格的前提下该怎么修」。

【评判维度】（每项 1-10）
playability 可玩性 · fairness 公平推理 · multiRoleDesign 多人设计 · pacing 章节节奏 · graphReady 编排可落地 · consistency 内部一致 · styleFit 风格契合（是否符合作者声明的风格与偏好）

【修改方向要求】
- revisions 至少 3 条（有问题时），按 priority 排序：must_fix > should_fix > optional
- targetLayer 只能是：brief | spec | outline | structure | roleMatrix | section | synopsis
- targetKey：可选，如 role-1、chapter-2、scene-3、clue-1；分幕层写 roleKey/chapterKey
- direction：具体改什么、为什么（50～200 字）
- promptHint：作者下一轮生成时可粘贴进「限制/角色要求/评判侧重」的**中文提示语**（一句话，可直接复用）
- preserve：在作者风格下应保留的优点，避免改没了

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
    "summary": "与作者风格的契合说明",
    "keepEmphasis": ["作者风格中应强化的方向"],
    "adjustEmphasis": ["为更好可玩性建议在风格框架内的微调"]
  },
  "strengths": ["优点"],
  "issues": [{"severity":"high|medium|low","area":"维度","detail":"问题"}],
  "revisions": [{
    "targetLayer": "roleMatrix",
    "targetKey": "role-1",
    "priority": "must_fix|should_fix|optional",
    "problem": "问题简述",
    "direction": "修改方向",
    "promptHint": "下轮生成用提示语",
    "preserve": "应保留的作者风格元素"
  }],
  "nextStepOrder": ["outline","roleMatrix","structure"],
  "readyForImport": false
}
nextStepOrder：建议作者按什么顺序回到哪几层重生成（layer 名数组，2～5 项）。
readyForImport：overallScore>=7、无 high severity、styleFit>=6 且无 must_fix 时为 true。`;
  const sampleSections = Object.entries(pipeline.sections || {}).flatMap(([roleKey, chapters]) =>
    Object.entries(chapters || {}).map(([chapterKey, section]) => ({
      roleKey,
      chapterKey,
      title: section.title,
      bodyPreview: cleanText(section.body, 400)
    }))
  ).slice(0, 2);
  const user = `请质检并给出修改方向。务必结合作者风格，不要建议背离 style/requirements/evaluationFocus 的改动。

${untrustedUserPayload("作者风格与评判侧重", authorStyle)}
${untrustedUserPayload("brief", pipeline.brief)}
${pipeline.spec ? untrustedUserPayload("规格", pipeline.spec) : ""}
${pipeline.outline ? untrustedUserPayload("总纲", compactOutline(pipeline.outline)) : ""}
${pipeline.proposal ? untrustedUserPayload("编排结构", compactProposal(pipeline.proposal)) : ""}
${pipeline.roleMatrix ? untrustedUserPayload("角色矩阵", compactRoleMatrix(pipeline.roleMatrix)) : ""}
${pipeline.synopsis ? untrustedUserPayload("短母稿", { title: pipeline.synopsis.title, summary: pipeline.synopsis.summary, overallManuscript: cleanText(pipeline.synopsis.overallManuscript, 1200), logicNotes: pipeline.synopsis.logicNotes }) : ""}
${pipeline.sampleSection ? untrustedUserPayload("分幕样本", { roleKey: pipeline.sampleSection.roleKey, chapterKey: pipeline.sampleSection.chapterKey, title: pipeline.sampleSection.title, bodyPreview: cleanText(pipeline.sampleSection.body, 600) }) : ""}
${sampleSections.length ? untrustedUserPayload("已生成分幕", sampleSections) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export { LAYER_LABELS };
