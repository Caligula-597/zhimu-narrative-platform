import { PRODUCT_BOUNDARY, cleanText, compactProposal, compactRoleMatrix, untrustedUserPayload } from "./shared.js";
import { buildPlayerPovBlock, HUMAN_PROSE_BLOCK, HUMAN_STORY_FOUNDATION_BLOCK } from "./human-authorship.js";
import { TERMINOLOGY_GROUNDING_BLOCK } from "./matrix-terminology-grounding.js";

export function buildRoleSectionMessages({ brief, spec, outline, proposal, roleMatrix, roleKey, chapterKey, sectionMinWords = 250, pov = "second" }) {
  const role = roleMatrix?.roles?.find((item) => item.key === roleKey);
  const chapter = proposal?.chapters?.find((item) => item.key === chapterKey);
  const beat = outline?.chapterBeats?.find((item) => item.chapterKey === chapterKey);
  const system = `你是剧本杀私人分幕主笔。本次只写**一位角色、一个章节**的一段正文，不要写其他角色或其他章节。

${PRODUCT_BOUNDARY}

${HUMAN_STORY_FOUNDATION_BLOCK}

${HUMAN_PROSE_BLOCK}

${TERMINOLOGY_GROUNDING_BLOCK}

${buildPlayerPovBlock(pov)}

【任务】
- 输出 JSON：roleKey、chapterKey、title、body。
- body 为已经锁定人称的玩家视角叙述，至少 ${sectionMinWords} 个中文字符，可分段，禁止跑团数值与占位语。
- 不得剧透 mustHide；knows/canDiscuss 边界须遵守。
- 先选择本角色本章一个正在发生的场景：谁向谁索取什么、对方如何抵抗、现场发生什么变化。不得把角色字段、章节摘要和任务依次改写成选定人称的说明文。
- 钱款、期限、身份与线索不得在一个段落里一次性交付完整；让事实从具体交谈、误解、回避和动作中逐步出现。
- 对白长度服从关系与处境，不得把交谈剪成“问一句—答几个字—再报一个数字”的短句阶梯。
- 不要输出 overallManuscript 或其他角色内容。

【输出 schema】
{"roleKey":"role-1","chapterKey":"chapter-1","title":"分幕标题","body":"正文"}`;
  const user = `请为角色 ${roleKey} 写章节 ${chapterKey} 的私人分幕。

${untrustedUserPayload("角色", role)}
${untrustedUserPayload("章节", chapter)}
${beat ? untrustedUserPayload("本章节拍", beat) : ""}
${untrustedUserPayload("公共结构摘要", compactProposal(proposal))}
${untrustedUserPayload("风格", { style: brief.style, requirements: brief.requirements })}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function summarizeExistingSections(sectionsByRole) {
  const lines = [];
  for (const [roleKey, chapters] of Object.entries(sectionsByRole || {})) {
    for (const [chapterKey, section] of Object.entries(chapters || {})) {
      lines.push(`${roleKey}/${chapterKey}: ${cleanText(section.body, 120)}`);
    }
  }
  return lines.length ? `已有分幕摘要（勿重复矛盾）：\n${lines.join("\n")}` : "";
}
