import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import { HUMAN_PROSE_BLOCK, HUMAN_STORY_FOUNDATION_BLOCK } from "./human-authorship.js";
import { TERMINOLOGY_GROUNDING_BLOCK } from "./matrix-terminology-grounding.js";
import { SOURCE_ADAPTATION_CONTINUITY_BLOCK } from "./source-adaptation-fidelity.js";

const PRIOR_CHAPTER_SUMMARY_CHARS = 600;
const PRIOR_CHAPTER_ENDING_CHARS = 2400;

/**
 * 前文上下文压缩：摘要 + 末尾片段，避免第 3 章起把前两章 8000 字全文塞进 prompt 导致超时。
 * 完整正文仍保存在 session；生成时只传衔接所需信息。
 */
export function compactPreviousChaptersForPrompt(previousChapters = []) {
  return previousChapters.map((ch) => {
    const body = cleanText(ch.narrativeBody, 120000);
    const summary = cleanText(ch.summary, PRIOR_CHAPTER_SUMMARY_CHARS);
    const base = { chapterKey: ch.chapterKey, title: cleanText(ch.title, 120), summary };
    if (!body) return { ...base, narrativeBody: "" };
    if (body.length <= PRIOR_CHAPTER_ENDING_CHARS + 500) {
      return { ...base, narrativeBody: body };
    }
    return {
      ...base,
      narrativeBodyLength: body.length,
      narrativeBodyEnding: body.slice(-PRIOR_CHAPTER_ENDING_CHARS),
      note: `前文共 ${body.length} 字；此处仅附摘要与末尾 ${PRIOR_CHAPTER_ENDING_CHARS} 字以便衔接，不得与前文章节矛盾。`
    };
  });
}

/** 逐章生成「总剧情」正文；每章携带此前各章压缩上下文，保证连贯。 */
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
  const prior = compactPreviousChaptersForPrompt(previousChapters);
  const system = `你是线上剧本杀「总剧情」主笔。你写的是**创作者用的章节母稿**（含 host 视角与公共事件），不是玩家私人分幕。

${PRODUCT_BOUNDARY}

${HUMAN_STORY_FOUNDATION_BLOCK}

${HUMAN_PROSE_BLOCK}

${TERMINOLOGY_GROUNDING_BLOCK}

${SOURCE_ADAPTATION_CONTINUITY_BLOCK}

【任务】
- 本次只写**一个章节**的 narrativeBody（中文叙述，目标约 ${targetWords} 字），承接 previousChapters 已发生事件，不得矛盾。
- 严格遵循【创作设定】与【剧情纲要】；第 ${chapterIndex + 1} 章须符合纲要中的分章打算。
- 若纲要含明确主题结论，只把它视为创作者关切，不得让旁白、世界或人物负责证明。章节必须以人物行动改变下一场现实，不能用轮流辩论代替剧情。
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
${prior.length ? untrustedUserPayload("此前各章（摘要+末尾片段，必须承接，不可推翻）", prior) : "（这是第一章，无前文）"}

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
  const prior = compactPreviousChaptersForPrompt(previousChapters);
  const bodyPreview = cleanText(partialChapter?.narrativeBody, 120000);
  const tail = bodyPreview.slice(-800);
  const system = `你是线上剧本杀「总剧情」主笔。你正在**续写**同一章的后半段，必须与已有正文无缝衔接，不得重复或矛盾。

${PRODUCT_BOUNDARY}

${HUMAN_PROSE_BLOCK}

${TERMINOLOGY_GROUNDING_BLOCK}

${SOURCE_ADAPTATION_CONTINUITY_BLOCK}

【任务】
- 在已有 narrativeBody 末尾继续写，本次追加约 ${remainingChars} 字（中文叙述）。
- 只输出续写片段与必要元数据，不要重复已有内容。
- 延续原人物的注意力与未说透之处；不得为了凑字补主题总结、排比回顾或象征性收尾。
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
