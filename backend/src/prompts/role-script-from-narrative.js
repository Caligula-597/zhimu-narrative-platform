import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";

const CHAPTER_SUMMARY_CHARS = 600;
const FOCUS_NARRATIVE_CHARS = 5000;
const CONTEXT_ENDING_CHARS = 1800;

/**
 * 角色剧本 prompt 用压缩总剧情：当前章详述，其余章摘要+末尾，避免 5×8000 字撑爆上下文。
 */
export function compactChaptersForRoleScriptPrompt(chapters = [], focusChapterKey = null) {
  return chapters.map((ch) => {
    const body = cleanText(ch.narrativeBody, 120000);
    const summary = cleanText(ch.summary, CHAPTER_SUMMARY_CHARS);
    const base = { chapterKey: ch.chapterKey, title: cleanText(ch.title, 120), summary };
    const isFocus = !focusChapterKey || ch.chapterKey === focusChapterKey;
    if (!body) return { ...base, narrativeBody: "" };
    if (isFocus) {
      if (body.length <= FOCUS_NARRATIVE_CHARS) return { ...base, narrativeBody: body };
      return {
        ...base,
        narrativeBodyLength: body.length,
        narrativeBody: body.slice(0, FOCUS_NARRATIVE_CHARS),
        note: `本章总剧情共 ${body.length} 字；此处附前 ${FOCUS_NARRATIVE_CHARS} 字供改编私人本。`
      };
    }
    if (body.length <= CONTEXT_ENDING_CHARS + 400) return { ...base, narrativeBody: body };
    return {
      ...base,
      narrativeBodyLength: body.length,
      narrativeBodyEnding: body.slice(-CONTEXT_ENDING_CHARS),
      note: `非当前章，仅附摘要与末尾 ${CONTEXT_ENDING_CHARS} 字作衔接参考。`
    };
  });
}

/** 为单个角色生成/改稿指定章节（或全部章节）的私人剧本 */
export function buildRoleScriptFromNarrativeMessages({
  setting,
  synopsis,
  role,
  chapters = [],
  chapterKey = null,
  existingSections = [],
  revisionHint = ""
}) {
  const focusKey = chapterKey ? cleanText(chapterKey, 40) : null;
  const targetKeys = focusKey ? [focusKey] : chapters.map((ch) => ch.chapterKey);
  const chapterPayload = compactChaptersForRoleScriptPrompt(chapters, focusKey);
  const minSectionWords = Math.max(800, Math.floor((setting.wordsPerChapter || 8000) / 6));
  const revision = revisionHint ? `\n【创作者改稿要求】\n${cleanText(revisionHint, 2000)}` : "";
  const existing = existingSections.length
    ? untrustedUserPayload("当前该角色已有分幕（改稿时在此基础上调整）", existingSections)
    : "";
  const scopeNote = focusKey
    ? `本次只写 chapterKey=${focusKey} 这一章的分幕。`
    : `输出该角色在每一章的 sections（共 ${targetKeys.length} 章）。`;
  const system = `你是剧本杀私人剧本编剧。根据**全书总剧情**，为**一位玩家角色**撰写私人正文。

${PRODUCT_BOUNDARY}

【任务】
- ${scopeNote}
- body 为玩家视角正文，每章建议 ${minSectionWords} 字以上；遵守角色 publicProfile / privateProfile，mustHide 内容不得提前泄露。
- 公共事件与总剧情一致；私人秘密仅在该角色文本中体现。

【输出 schema】
{
  "roleKey": "${role.key}",
  "sections": [
    {"roleKey":"${role.key}","chapterKey":"${targetKeys[0] || "ch1"}","title":"分幕标题","body":"私人正文"}
  ],
  "suggestions": ["改编建议"]
}`;
  const user = `${creativeInputUserBlocks(setting, synopsis)}

${untrustedUserPayload("当前角色", role)}
${untrustedUserPayload("各章总剧情（当前章详述，其余章压缩）", chapterPayload)}
${existing}${revision}

sections 必须覆盖：${targetKeys.join("、")}。只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
