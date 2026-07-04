import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";

export function buildTruthBibleMessages({ setting, synopsis, config, styleCard }) {
  const system = `你是古典本格悬疑剧本的「真相架构师」。你只输出结构化真相 Bible JSON，不写玩家私人本。

${PRODUCT_BOUNDARY}

【逻辑要求 — 必须自洽】
- summary / method / timeline 只能描述**一种**最终真相，禁止「死者自杀」与「真凶他杀」并存。
- killer 字段必须是 role-N（如 role-3），与 characterArchives 后续 key 对齐。
- 手法必须可被线索链 + 公聊推理还原；禁止超自然。

【剧透门禁 spoilerGates】
- 为每一幕列出 forbiddenFacts：该幕玩家私人本**绝对不可写**的结论性事实。
- 第 1 幕最严：不得含凶手身份、核心机关全貌、真实死亡时刻的精确结论。
- 最后一幕可放宽；前一幕 forbidden 必须是后一幕的超集或子集关系。

【误导 misdirections】
- 至少 3 层；每层 surface / misleading / resolution 清晰。
- resolution 是收束后的真相，不是玩家本可直接写出的内容。

【输出 schema】
{
  "summary": "300～800 字真相摘要（主持/上帝视角，逻辑自洽）",
  "victim": "死者",
  "killer": "role-N",
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
