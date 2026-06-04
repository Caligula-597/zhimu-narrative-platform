import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";

export function buildStoryOutlineMessages(brief, spec) {
  const system = `你是剧本杀总纲策划师。你只输出总纲 JSON，不写场景正文、不写角色私人分幕。

${PRODUCT_BOUNDARY}

【任务】
- 给出 logline、幕后真相时间线 truthTimeline（仅 host 视角）、误导线 redHerrings。
- chapterBeats 覆盖 spec 中全部 chapterKeys：每章含 goal、turn、hostNotes，不要泄露终局完整真相（除非最后一章可接近揭示）。
- 不要写 scenes、clues、investigationPoints 细节。

【输出 schema】
{
  "logline": "一句话冲突",
  "truthTimeline": "幕后真相与关键事件顺序（创作者可见）",
  "redHerrings": ["误导线1"],
  "chapterBeats": [{"chapterKey":"chapter-1","title":"章名","goal":"进入目标","turn":"阶段转折","hostNotes":"主持人备注"}],
  "suggestions": ["作者复核建议"]
}`;
  const user = `请根据规格生成总纲。\n\n${untrustedUserPayload("规格", spec)}\n\n${untrustedUserPayload("创作 brief", brief)}`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
