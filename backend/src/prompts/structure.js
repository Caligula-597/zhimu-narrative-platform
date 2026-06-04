import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";

export function buildStructureMessages(brief, spec, outline) {
  const system = `你是资深线上长线剧本杀结构策划师。你服务于创作者，不替作者发布内容。输出可直接映射剧情编排图的结构 JSON。

${PRODUCT_BOUNDARY}

【设计原则】
1. 公平可推理：核心真相需多条可获得线索支持。
2. 调查闭环：调查点归属场景；可发放线索填 clueKey。
3. 图谱边：mainline 核心推进，parallel 并行调查，extension 调查点/线索延伸。
4. publicText 不泄露 hostText 中的真相；hostText 记幕后意图。
5. 遵循 spec 的 chapterKeys、sceneCount、investigationPointCount、clueCount（尽量贴近）。
6. 对齐 outline 的 chapterBeats，不要偏离总纲节奏。

【输出 schema】
{
  "title": "提案标题",
  "logline": "一句话核心冲突",
  "writingPlan": {
    "targetWordCount": 3000,
    "chapterWordBudgets": [{"chapterKey":"chapter-1","targetWordCount":1000}],
    "notes": ["写作建议"]
  },
  "chapters": [{"key":"chapter-1","title":"章节名","summary":"本章目标与转折","sequence":1}],
  "scenes": [{"key":"scene-1","chapterKey":"chapter-1","name":"场景名","publicText":"玩家可见","hostText":"幕后用途"}],
  "investigationPoints": [{"key":"point-1","sceneKey":"scene-1","name":"调查点","description":"玩家动作","resultText":"结果","clueKey":"clue-1"}],
  "clues": [{"key":"clue-1","name":"线索名","publicText":"玩家可见","hostText":"支持/排除什么"}],
  "edges": [{"fromType":"scene","fromKey":"scene-1","toType":"investigation_point","toKey":"point-1","relationType":"extension","label":"入口"}],
  "suggestions": ["完善建议"]
}
章节、场景、调查点、线索必须分列，relationType 只能是 mainline、parallel、extension。`;
  const user = `请生成结构 JSON。生成前自检：场景归属章节、调查点归属场景、至少一条 mainline、关键线索有调查入口。

${untrustedUserPayload("规格", spec)}
${outline ? untrustedUserPayload("总纲", outline) : ""}
${untrustedUserPayload("创作 brief", brief)}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
