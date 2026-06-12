import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";

/** 逐章生成「总剧情」正文；每章携带此前各章全文，保证连贯。 */
export function buildChapterNarrativeMessages({
  setting,
  synopsis,
  config,
  chapterKey,
  chapterIndex,
  chapterCount,
  previousChapters = []
}) {
  const targetWords = setting.wordsPerChapter || 8000;
  const prior = previousChapters.map((ch) => ({
    chapterKey: ch.chapterKey,
    title: ch.title,
    summary: cleanText(ch.summary, 400),
    narrativeBody: cleanText(ch.narrativeBody, 120000)
  }));
  const system = `你是线上剧本杀「总剧情」主笔。你写的是**创作者用的章节母稿**（含 host 视角与公共事件），不是玩家私人分幕。

${PRODUCT_BOUNDARY}

【任务】
- 本次只写**一个章节**的 narrativeBody（中文叙述，目标约 ${targetWords} 字），承接 previousChapters 已发生事件，不得矛盾。
- 严格遵循【创作设定】与【剧情纲要】；第 ${chapterIndex + 1} 章须符合纲要中的分章打算。
- 输出 JSON，不要 Markdown 围栏。

【输出 schema】
{
  "chapterKey": "${chapterKey}",
  "title": "章节标题",
  "summary": "本章 80～200 字摘要",
  "narrativeBody": "本章总剧情正文",
  "hostNotes": "仅主持人可见：真相片段、节奏、下一章衔接",
  "openThreads": ["未解悬念1"],
  "resolvedThreads": ["已收束悬念（若有）"],
  "suggestions": ["作者复核建议"]
}`;
  const user = `请撰写第 ${chapterIndex + 1}/${chapterCount} 章（chapterKey=${chapterKey}）。

${creativeInputUserBlocks(setting, synopsis)}

${untrustedUserPayload("章节配置", { chapterKeys: config.chapterKeys, wordsPerChapter: targetWords })}
${prior.length ? untrustedUserPayload("此前各章全文（必须承接，不可推翻）", prior) : "（这是第一章，无前文）"}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

/** 当首轮 narrativeBody 未达目标字数时，续写后半段（避免 JSON 单次输出截断）。 */
export function buildChapterNarrativeContinuationMessages({
  setting,
  synopsis,
  config,
  chapterKey,
  chapterIndex,
  chapterCount,
  previousChapters = [],
  partialChapter,
  remainingChars
}) {
  const prior = previousChapters.map((ch) => ({
    chapterKey: ch.chapterKey,
    title: ch.title,
    summary: cleanText(ch.summary, 400),
    narrativeBody: cleanText(ch.narrativeBody, 120000)
  }));
  const bodyPreview = cleanText(partialChapter?.narrativeBody, 120000);
  const tail = bodyPreview.slice(-800);
  const system = `你是线上剧本杀「总剧情」主笔。你正在**续写**同一章的后半段，必须与已有正文无缝衔接，不得重复或矛盾。

${PRODUCT_BOUNDARY}

【任务】
- 在已有 narrativeBody 末尾继续写，本次追加约 ${remainingChars} 字（中文叙述）。
- 只输出续写片段与必要元数据，不要重复已有内容。
- 输出 JSON，不要 Markdown 围栏。

【输出 schema】
{
  "narrativeBodyContinuation": "紧接上文的新增正文（不含重复段落）",
  "hostNotesAppend": "可选：追加主持备注",
  "summary": "更新后的全章摘要（80～200 字，覆盖整章）",
  "openThreads": ["未解悬念"],
  "resolvedThreads": ["已收束悬念"],
  "suggestions": ["续写说明"]
}`;
  const user = `请续写第 ${chapterIndex + 1}/${chapterCount} 章（chapterKey=${chapterKey}）。

${creativeInputUserBlocks(setting, synopsis)}

${untrustedUserPayload("章节配置", { chapterKeys: config.chapterKeys, wordsPerChapter: setting.wordsPerChapter, remainingChars })}
${prior.length ? untrustedUserPayload("此前各章全文", prior) : ""}
${untrustedUserPayload("本章已有正文（勿重复）", {
  title: partialChapter?.title,
  currentLength: bodyPreview.length,
  endingPreview: tail
})}

narrativeBodyContinuation 须直接承接 endingPreview 之后的情节。只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
