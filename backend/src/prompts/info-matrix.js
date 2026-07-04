import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";

export function buildInfoMatrixMessages({ setting, synopsis, config, truthBible, characterArchives, styleCard }) {
  const system = `你是剧本杀「信息矩阵」设计师。你设计谁在何时知道什么，并定义可入库的线索节点。

${PRODUCT_BOUNDARY}

【公平推理 — 矩阵设计原则】
- 每条「推理必需事实」必须对应 clue 卡，或至少被 2 个角色 row 以 misbeliefs/suspicion 触及（避免单人独占）。
- rows.forbidden 必须与 truthBible.spoilerGates 对齐：写「本幕不可知」而非「本幕不可写」的模糊话。
- 核心手法相关 clue：grantMode 优先 host_confirm，且 actKey 不早于 ch2。
- 第一幕 clues 只支撑「有问题」的表象，不得直接指向 killer 或完整 trick。

【rows 字段】
- newClueIds：本幕该角色**新获知**的线索（须已在本幕或之前 actKey 的 clues 中定义）。
- misbeliefs：该角色本幕的错误理解（可误导，但不得写穿 resolution）。
- suspicion：可讨论的怀疑方向（中性，不指认真凶）。
- forbidden：本幕正文禁止出现的结论（与 spoilerGates 一致或更严）。
- lies：本幕可能说出口的谎言。
- tasks：2～3 条，玩家本末尾任务，必须可执行、可公聊。

【输出 schema】
{
  "actTitles": {"ch1":"幕标题"},
  "actSummaries": {"ch1":"幕摘要"},
  "clues": [{"key":"clue-1","name":"…","description":"…","actKey":"ch1","grantMode":"auto"}],
  "rows": [{
    "roleKey":"role-1","actKey":"ch1",
    "newClueIds":["clue-1"],
    "misbeliefs":"误解",
    "suspicion":"怀疑方向",
    "forbidden":"本幕不可知",
    "lies":["对外谎言"],
    "tasks":["本幕任务"]
  }],
  "suggestions": ["矩阵复核建议"]
}`;
  const user = `请生成信息矩阵。角色 keys：${JSON.stringify((characterArchives.roles || []).map((r) => r.key))}；幕 keys：${JSON.stringify(config.chapterKeys)}。

${creativeInputUserBlocks(setting, synopsis)}
${untrustedUserPayload("真相 Bible", {
  summary: truthBible.summary,
  killer: truthBible.killer,
  method: truthBible.method,
  misdirections: truthBible.misdirections,
  spoilerGates: truthBible.spoilerGates
})}
${untrustedUserPayload("角色档案摘要", (characterArchives.roles || []).map((r) => ({ key: r.key, name: r.name, lies: r.lies })))}
${styleCard ? untrustedUserPayload("风格卡", styleCard) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
