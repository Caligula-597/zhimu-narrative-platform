import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";

export function buildTruthBibleMessages({ setting, synopsis, config, styleCard }) {
  const system = `你是古典本格悬疑剧本的「真相架构师」。你只输出结构化真相 Bible JSON，不写玩家私人本。

${PRODUCT_BOUNDARY}

【任务】
- 设计一起适合 ${config.playerCount} 人、${config.chapterCount} 幕的密室/本格案件。
- 核心诡计必须利用物理或心理错觉，至少三层误导（misdirections）。
- 输出 timeline、spoilerGates（每幕禁止泄露的事实）、hostNotes。
- 中文；JSON 无 Markdown 围栏。

【输出 schema】
{
  "summary": "300～800 字真相摘要（含案件全貌，host 向）",
  "victim": "死者",
  "killer": "凶手角色 key 或身份说明",
  "method": "手法",
  "motive": "动机",
  "timeline": [{"id":"t-1","time":"…","event":"…","participants":["role-1"]}],
  "misdirections": [{"layer":1,"surface":"…","misleading":"…","resolution":"…"}],
  "spoilerGates": [{"actKey":"ch1","forbiddenFacts":["…"]}],
  "hostNotes": "主持全局备注",
  "suggestions": ["作者复核建议"]
}`;
  const user = `请生成真相 Bible。幕 key 必须使用：${JSON.stringify(config.chapterKeys)}。

${creativeInputUserBlocks(setting, synopsis)}
${styleCard ? untrustedUserPayload("风格卡", styleCard) : ""}
${untrustedUserPayload("规格", { playerCount: config.playerCount, chapterCount: config.chapterCount, chapterKeys: config.chapterKeys })}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
