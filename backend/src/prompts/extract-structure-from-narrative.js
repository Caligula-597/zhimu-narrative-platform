import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";

/** 从总剧情文本中**抽取**场景、调查点、线索与图谱边（而非先编结构再写文）。 */
export function buildExtractStructureFromNarrativeMessages({ brief, spec, chapters = [], sectionsSample = [] }) {
  const chapterPayload = chapters.map((ch) => ({
    chapterKey: ch.chapterKey,
    title: ch.title,
    narrativeBody: cleanText(ch.narrativeBody, 5000)
  }));
  const system = `你是剧本杀编排工程师。你从**已写好的章节总剧情**中抽取可落库的编排结构 JSON，映射剧情编排台。

${PRODUCT_BOUNDARY}

【原则】
1. **只抽取** narrativeBody 中已出现或明确隐含的场景、可调查动作、可发放线索；不要发明无关节点。
2. 每个 clue 须在 investigationPoints 中有入口（clueKey 关联）。
3. publicText 不得泄露 hostText 中的完整真相。
4. 遵循 spec 的 chapterKeys；sceneCount / clueCount 尽量贴近 spec，不足时在 suggestions 说明。
5. edges：mainline 串联章节推进，extension 连接场景→调查点，parallel 为并行支路。

【输出 schema】与结构提案相同：
{
  "title": "剧本名",
  "logline": "一句话",
  "chapters": [{"key":"chapter-1","title":"章名","summary":"摘要","sequence":1}],
  "scenes": [{"key":"scene-1","chapterKey":"chapter-1","name":"场景名","publicText":"玩家可见","hostText":"幕后"}],
  "investigationPoints": [{"key":"point-1","sceneKey":"scene-1","name":"调查点","description":"动作","resultText":"结果","clueKey":"clue-1"}],
  "clues": [{"key":"clue-1","name":"线索名","publicText":"玩家可见","hostText":"支持/排除什么"}],
  "edges": [{"fromType":"scene","fromKey":"scene-1","toType":"investigation_point","toKey":"point-1","relationType":"extension","label":"入口"}],
  "suggestions": ["抽取说明"]
}`;
  const user = `请从以下总剧情抽取编排结构。

${untrustedUserPayload("规格", spec)}
${untrustedUserPayload("brief", { title: brief.title, premise: brief.premise })}
${untrustedUserPayload("各章总剧情", chapterPayload)}
${sectionsSample.length ? untrustedUserPayload("分幕样本（辅助定位线索）", sectionsSample.slice(0, 3)) : ""}

生成前自检：场景归属章节、调查点归属场景、线索有入口、至少一条 mainline。只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
