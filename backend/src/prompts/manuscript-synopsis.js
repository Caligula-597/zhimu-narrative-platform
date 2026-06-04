import { PRODUCT_BOUNDARY, compactOutline, compactProposal, compactRoleMatrix, untrustedUserPayload } from "./shared.js";

export function buildManuscriptSynopsisMessages(brief, outline, proposal, roleMatrix) {
  const system = `你是剧本杀幕后母稿编辑。你只输出**短母稿** JSON，供创作者阅读，不替代玩家私人剧本。

${PRODUCT_BOUNDARY}

【任务】
- overallManuscript：800～1500 个中文字符，分章节标题说明背景真相、推进节奏、误导与结局条件（可含 host 真相）。
- summary：200 字以内简介；logicNotes：3～6 条逻辑说明。
- 不要写角色私人分幕正文。

【输出 schema】
{"title":"剧本名","summary":"简介","overallManuscript":"短母稿","logicNotes":["逻辑说明"]}`;
  const user = `请写短幕后母稿。

${untrustedUserPayload("brief", { title: brief.title, premise: brief.premise })}
${outline ? untrustedUserPayload("总纲", compactOutline(outline)) : ""}
${untrustedUserPayload("结构摘要", compactProposal(proposal))}
${untrustedUserPayload("角色矩阵摘要", compactRoleMatrix(roleMatrix))}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
