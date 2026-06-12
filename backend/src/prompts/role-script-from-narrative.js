import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";

/** 为单个角色生成/改稿全部章节的私人剧本 */
export function buildRoleScriptFromNarrativeMessages({
  setting,
  synopsis,
  role,
  chapters = [],
  existingSections = [],
  revisionHint = ""
}) {
  const chapterPayload = chapters.map((ch) => ({
    chapterKey: ch.chapterKey,
    title: ch.title,
    narrativeBody: cleanText(ch.narrativeBody, 12000)
  }));
  const revision = revisionHint ? `\n【创作者改稿要求】\n${cleanText(revisionHint, 2000)}` : "";
  const existing = existingSections.length
    ? untrustedUserPayload("当前该角色已有分幕（改稿时在此基础上调整）", existingSections)
    : "";
  const system = `你是剧本杀私人剧本编剧。根据**全书总剧情**，为**一位玩家角色**撰写其在每一章的私人正文。

${PRODUCT_BOUNDARY}

【任务】
- 只输出**当前这一位角色**在每一章的 sections（共 ${chapters.length} 章）。
- body 为玩家视角正文，每章建议 ${Math.max(800, Math.floor(setting.wordsPerChapter / 6))} 字以上；遵守角色 publicProfile / privateProfile，mustHide 内容不得提前泄露。
- 公共事件与总剧情一致；私人秘密仅在该角色文本中体现。

【输出 schema】
{
  "roleKey": "${role.key}",
  "sections": [
    {"roleKey":"${role.key}","chapterKey":"ch1","title":"分幕标题","body":"私人正文"}
  ],
  "suggestions": ["改编建议"]
}`;
  const user = `${creativeInputUserBlocks(setting, synopsis)}

${untrustedUserPayload("当前角色", role)}
${untrustedUserPayload("各章总剧情全文", chapterPayload)}
${existing}${revision}

sections 必须覆盖全部 chapterKey。只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
