import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import { resolveKillerRoleKey, spoilerGateForAct } from "./matrix-prompt-engine.js";

export function buildHostRunbookMessages({ setting, synopsis, config, truthBible, infoMatrix, characterArchives, actKey }) {
  const actRows = (infoMatrix.rows || []).filter((r) => r.actKey === actKey);
  const actClues = (infoMatrix.clues || []).filter((c) => c.actKey === actKey);
  const gate = spoilerGateForAct(truthBible, actKey);
  const killerKey = resolveKillerRoleKey(truthBible, characterArchives);
  const system = `你是剧本杀主持/runbook 编写者。为本幕写主持操作手册，不写玩家私人正文。

${PRODUCT_BOUNDARY}

【剧透安全 — hostTruth】
- hostTruth 是主持独知，但不得包含本幕 spoilerGates.forbiddenFacts 中的结论（主持心里知道可以，文案不得复述给玩家听的「一句话剧透」）。
- 第一、二幕 hostTruth 禁止出现 killer 姓名/key；第三幕才可完整复盘。
- clueGrants 只能发放 actKey=${actKey} 的线索，不得提前发放后续幕 clue。

【任务】
- flow：本幕流程（何时讨论、何时搜证、何时发放线索）。
- hostTruth：本幕主持操作所需片段（时间线核对、线索含义），遵守剧透门禁。
- clueGrants：何时发放哪些 clueId（仅限本幕线索）。
- fallbacks：卡关兜底（用中性提示，不直接说凶手）。

【输出 schema】
{
  "actKey": "${actKey}",
  "title": "幕标题",
  "flow": "流程说明",
  "hostTruth": "主持真相片段（遵守剧透门禁）",
  "clueGrants": [{"clueId":"clue-1","when":"…"}],
  "fallbacks": ["兜底建议"],
  "suggestions": []
}`;
  const user = `请为 actKey=${actKey} 撰写主持手册。

${creativeInputUserBlocks(setting, synopsis)}
${untrustedUserPayload("本幕剧透门禁", gate)}
${killerKey ? untrustedUserPayload("真凶 key（hostTruth 前几幕勿明示）", { killerRoleKey: killerKey }) : ""}
${untrustedUserPayload("本幕线索", actClues)}
${untrustedUserPayload("本幕角色状态", actRows)}
${untrustedUserPayload("真相摘要（主持向）", { summary: truthBible.summary, method: truthBible.method })}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
