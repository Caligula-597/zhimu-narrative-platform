import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";

export function buildHostRunbookMessages({ setting, synopsis, config, truthBible, infoMatrix, actKey }) {
  const actRows = (infoMatrix.rows || []).filter((r) => r.actKey === actKey);
  const actClues = (infoMatrix.clues || []).filter((c) => c.actKey === actKey);
  const system = `你是剧本杀主持/runbook 编写者。为本幕写主持操作手册，不写玩家私人正文。

${PRODUCT_BOUNDARY}

【任务】
- flow：本幕流程（何时讨论、何时搜证、何时发放线索）。
- hostTruth：仅主持可见的真相片段。
- clueGrants：何时发放哪些 clueId。
- fallbacks：卡关兜底。

【输出 schema】
{
  "actKey": "${actKey}",
  "title": "幕标题",
  "flow": "流程说明",
  "hostTruth": "主持真相片段",
  "clueGrants": [{"clueId":"clue-1","when":"…"}],
  "fallbacks": ["兜底建议"],
  "suggestions": []
}`;
  const user = `请为 actKey=${actKey} 撰写主持手册。

${creativeInputUserBlocks(setting, synopsis)}
${untrustedUserPayload("本幕线索", actClues)}
${untrustedUserPayload("本幕角色状态", actRows)}
${untrustedUserPayload("真相摘要", { summary: truthBible.summary, method: truthBible.method })}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
