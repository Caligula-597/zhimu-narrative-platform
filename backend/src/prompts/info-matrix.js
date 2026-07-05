import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import {
  buildMatrixModeProfile,
  formatMatrixCreativePromptBlock,
  isLayerEnabled
} from "./matrix-2-mode.js";

export function buildInfoMatrixMessages({ setting, synopsis, config, truthBible, characterArchives, styleCard }) {
  const modeProfile = buildMatrixModeProfile(setting);
  const creativeBlock = formatMatrixCreativePromptBlock(setting, styleCard);
  const l4 = isLayerEnabled(modeProfile, "L4");

  const system = `你是剧本杀「信息矩阵 · Matrix 2.0」设计师。设计 L2 公共池 + 角色 rows +（可选）L4 触发器。

${PRODUCT_BOUNDARY}

${creativeBlock}

【L2 公共信息池 — 必填】
- clues：主持可发的线索卡；grantMode: auto | host_confirm。
- 每条 clue 增加 source: Environment | Public_Witness | ClueCard${modeProfile.key === "henkaku" ? " | Ritual_State" : ""}。
- 推理必需事实须落在 L2 clue 或 ≥2 角色 row 可触及路径 — **禁止**只锁在单人 tasks。
- publicEnvironmentByAct：每幕 80～200 字公共环境描写（全场可见锚点：血迹、上锁的门、天气、公开对话摘要）。
- scenes（可选）：{ key, name, actKey, clueIds[] } 场景调查点。

【推理面包屑 — 本格必填】
- 终幕定案用的物证/目击，须在前幕已有 L2 公共锚点或 row 可观察行为铺垫（递进怀疑链，禁止终幕「天降铁证」如突然指纹/DNA）。
- 同一推理链按幕递进：ch1 公共疑点 → ch2 角色感知/目击 → ch3 交叉验证收束。
- rows.tasks 中每个「是否…/解释…/去过…」动词，须在对应幕有可写进剧本的物理动作（推门、翻箱、对质某人）。

【L3/L5 在 rows 中的映射】
- rows.tasks = L5 **表层目标**（对质/公开/辩护；禁止「收集 N 条线索」）。
- rows.misbeliefs / suspicion = 可圆的红鲱鱼方向。
- rows.newClueIds = 本幕该角色**新获知**的 L2 线索（不是独家推理必需事实）。
- rows.forbidden = 本幕不可写的结论（对齐 spoilerGates）。

${l4 ? `【L4 机制触发器 — 变格必填】
- mechanicalTriggers: [{ key, actKey, if: "条件", then: "unlock_clue|activate_segment|state_change", hostNote }]
` : "【L4】本格模式 mechanicalTriggers 留空数组 []。"}

【输出 schema】
{
  "actTitles": {"ch1":"幕标题"},
  "actSummaries": {"ch1":"幕摘要"},
  "publicEnvironmentByAct": {"ch1":"公共环境描写"},
  "scenes": [{"key":"scene-1","name":"灯室","actKey":"ch2","clueIds":["clue-5"]}],
  "clues": [{"key":"clue-1","name":"…","description":"…","actKey":"ch1","grantMode":"auto","source":"Environment"}],
  "mechanicalTriggers": [],
  "rows": [{
    "roleKey":"role-1","actKey":"ch1",
    "newClueIds":["clue-1"],
    "misbeliefs":"误解",
    "suspicion":"怀疑方向",
    "forbidden":"本幕不可知",
    "lies":["对外谎言"],
    "tasks":["表层任务：说明…/是否公开…"]
  }],
  "suggestions": ["矩阵复核建议"]
}`;

  const user = `请生成 Matrix 2.0 信息矩阵。角色 keys：${JSON.stringify((characterArchives.roles || []).map((r) => r.key))}；幕 keys：${JSON.stringify(config.chapterKeys)}。

${creativeInputUserBlocks(setting, synopsis)}
${untrustedUserPayload("L1 真相 Bible", {
  summary: truthBible.summary,
  killer: truthBible.killer,
  method: truthBible.method,
  misdirections: truthBible.misdirections,
  spoilerGates: truthBible.spoilerGates,
  supernaturalRules: truthBible.supernaturalRules
})}
${untrustedUserPayload("角色档案摘要", (characterArchives.roles || []).map((r) => ({ key: r.key, name: r.name, lies: r.lies })))}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
