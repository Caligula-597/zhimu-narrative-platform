import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";

export function buildInfoMatrixMessages({ setting, synopsis, config, truthBible, characterArchives, styleCard }) {
  const system = `你是剧本杀「信息矩阵」设计师。你设计谁在何时知道什么，并定义可入库的线索节点。

${PRODUCT_BOUNDARY}

【任务】
- clues：每条线索有唯一 key（clue-1…）、name、description、actKey、grantMode（auto|host_confirm|explore）。
- rows：每位角色 × 每幕一行，含 newClueIds、misbeliefs、suspicion、forbidden、lies、tasks。
- actTitles / actSummaries：每幕标题与一句话摘要。
- 确保信息差在不同幕间动态变化；所有 clue 必须被至少一行 row 引用或可在 host 发放。

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
${untrustedUserPayload("真相 Bible", { summary: truthBible.summary, killer: truthBible.killer, spoilerGates: truthBible.spoilerGates })}
${untrustedUserPayload("角色档案摘要", (characterArchives.roles || []).map((r) => ({ key: r.key, name: r.name, lies: r.lies })))}
${styleCard ? untrustedUserPayload("风格卡", styleCard) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
