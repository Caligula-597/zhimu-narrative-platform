import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";

/** 从总剧情章节母稿，拆出各角色私人分幕（按章）。 */
export function buildRolesFromNarrativeMessages({ brief, spec, roleMatrix, chapters = [] }) {
  const chapterPayload = chapters.map((ch) => ({
    chapterKey: ch.chapterKey,
    title: ch.title,
    summary: cleanText(ch.summary, 300),
    narrativeBody: cleanText(ch.narrativeBody, 5000)
  }));
  const roles = (roleMatrix?.roles || []).map((r) => ({
    key: r.key,
    name: r.name,
    publicProfile: cleanText(r.publicProfile, 400),
    privateProfile: cleanText(r.privateProfile, 800),
    chapterKnowledge: r.chapterKnowledge
  }));
  const system = `你是剧本杀私人分幕改编编辑。输入是**各章总剧情母稿**与**角色矩阵**；你输出各角色各章的玩家视角正文。

${PRODUCT_BOUNDARY}

【任务】
- 为每位角色的每一章生成 section：roleKey、chapterKey、title、body。
- body 为玩家第一人称或有限第三人称，至少 250 字；遵守 matrix 中 knows / mustHide / canDiscuss，**不得泄露 mustHide**。
- 总剧情中的公共事件各角色版本应一致；私人秘密仅在该角色 body 中体现。
- 不要改写总剧情设定；不要输出 scenes/clues。

【输出 schema】
{
  "sections": [
    {"roleKey":"role-1","chapterKey":"chapter-1","title":"分幕标题","body":"私人正文"}
  ],
  "suggestions": ["改编注意"]
}`;
  const user = `请从总剧情拆出全部角色×章节的私人分幕。

${untrustedUserPayload("规格", spec)}
${untrustedUserPayload("brief", { title: brief.title, style: brief.style, requirements: brief.requirements })}
${untrustedUserPayload("角色矩阵", { roles })}
${untrustedUserPayload("各章总剧情", chapterPayload)}

sections 必须覆盖每位角色的每一章。只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
