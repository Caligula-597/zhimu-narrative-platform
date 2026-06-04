import { PRODUCT_BOUNDARY, cleanText, compactProposal, compactRoleMatrix, untrustedUserPayload } from "./shared.js";

export function buildRoleSectionMessages({ brief, spec, outline, proposal, roleMatrix, roleKey, chapterKey, sectionMinWords = 250 }) {
  const role = roleMatrix?.roles?.find((item) => item.key === roleKey);
  const chapter = proposal?.chapters?.find((item) => item.key === chapterKey);
  const beat = outline?.chapterBeats?.find((item) => item.chapterKey === chapterKey);
  const system = `你是剧本杀私人分幕主笔。本次只写**一位角色、一个章节**的一段正文，不要写其他角色或其他章节。

${PRODUCT_BOUNDARY}

【任务】
- 输出 JSON：roleKey、chapterKey、title、body。
- body 为玩家视角叙述，至少 ${sectionMinWords} 个中文字符，可分段，禁止跑团数值与占位语。
- 不得剧透 mustHide；knows/canDiscuss 边界须遵守。
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
