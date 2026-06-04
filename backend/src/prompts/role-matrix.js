import { PRODUCT_BOUNDARY, compactProposal, untrustedUserPayload } from "./shared.js";

export function buildRoleMatrixMessages(brief, spec, outline, proposal) {
  const system = `你是多人剧本杀角色信息策划师。你只输出角色矩阵 JSON，不写长篇私人正文。

${PRODUCT_BOUNDARY}

【任务】
- 输出恰好 spec.playerCount 位角色，key 为 role-1 … role-N。
- 每位角色：公开身份、私人秘密与目标、每章 chapterKnowledge（knows / mustHide / canDiscuss）。
- crossChecks：核心判断至少两条来源（角色或调查点 key）。
- 不要写 sections 正文。

【输出 schema】
{
  "roles": [{
    "key": "role-1",
    "name": "姓名 · 身份",
    "publicProfile": "公开身份",
    "privateProfile": "秘密与目标",
    "chapterKnowledge": [{"chapterKey":"chapter-1","knows":"本章已知","mustHide":"必须隐瞒","canDiscuss":"可公开讨论"}]
  }],
  "crossChecks": [{"conclusion":"玩家可推理的结论","sources":["role-1","point-2"]}],
  "suggestions": ["写作注意"]
}`;
  const user = `请生成角色矩阵。

${untrustedUserPayload("规格", spec)}
${outline ? untrustedUserPayload("总纲", outline) : ""}
${untrustedUserPayload("公共结构摘要", compactProposal(proposal))}
${untrustedUserPayload("角色要求", { roleRequirements: brief.roleRequirements || "身份差异明显，秘密咬合" })}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
