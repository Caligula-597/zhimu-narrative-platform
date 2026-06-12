import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";

/** 逐章生成「总剧情」正文；每章携带此前各章全文，保证连贯。 */
export function buildChapterNarrativeMessages({ brief, spec, chapterKey, chapterIndex, chapterCount, previousChapters = [] }) {
  const prior = previousChapters.map((ch) => ({
    chapterKey: ch.chapterKey,
    title: ch.title,
    summary: cleanText(ch.summary, 400),
    narrativeBody: cleanText(ch.narrativeBody, 6000)
  }));
  const system = `你是线上剧本杀「总剧情」主笔。你写的是**创作者用的章节母稿**（含 host 视角与公共事件），不是玩家私人分幕。

${PRODUCT_BOUNDARY}

【任务】
- 本次只写**一个章节**的 narrativeBody（中文叙述，800～2500 字），承接 previousChapters 已发生事件，不得矛盾。
- 第 1 章：建立冲突与人物处境；中间章：推进调查与误导；末章：可接近揭示但 public 层仍避免直接写死「真凶全名+完整手法」于玩家可见段落（hostNotes 可写全）。
- 输出 JSON，不要 Markdown 围栏。

【输出 schema】
{
  "chapterKey": "chapter-1",
  "title": "章节标题",
  "summary": "本章 80～200 字摘要",
  "narrativeBody": "本章总剧情正文（时间线、场景、公开事件、调查进展、角色互动；可含 host 括号备注）",
  "hostNotes": "仅主持人可见：真相片段、节奏、下一章衔接",
  "openThreads": ["未解悬念1"],
  "resolvedThreads": ["已收束悬念（若有）"],
  "suggestions": ["作者复核建议"]
}`;
  const user = `请撰写第 ${chapterIndex + 1}/${chapterCount} 章（chapterKey=${chapterKey}）。

${untrustedUserPayload("规格", spec)}
${untrustedUserPayload("创作 brief", brief)}
${prior.length ? untrustedUserPayload("此前各章全文（必须承接，不可推翻）", prior) : "（这是第一章，无前文）"}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
