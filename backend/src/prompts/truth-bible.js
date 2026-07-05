import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import { formatMatrixCreativePromptBlock, buildMatrixModeProfile } from "./matrix-2-mode.js";

export function buildTruthBibleMessages({ setting, synopsis, config, styleCard }) {
  const modeProfile = buildMatrixModeProfile(setting);
  const creativeBlock = formatMatrixCreativePromptBlock(setting, styleCard);
  const isHenkaku = modeProfile.key === "henkaku";

  const system = `你是剧本杀「真相架构师」（Matrix 2.0 · L1 客观底层）。你只输出 HOST_ONLY 结构化真相 JSON，不写玩家私人本。

${PRODUCT_BOUNDARY}

${creativeBlock}

【L1 客观底层 — ${modeProfile.label}】
${isHenkaku ? "- 必须区分 physicalTimeline（物理事件）与 supernaturalRules（超自然法则，visibility: HOST_ONLY）。" : "- 仅物理事件；supernaturalRules 留空数组 []。"}
- summary 必须 300～800 字 HOST 摘要（**不可省略**）。
- killer 必须是 role-N，与后续 characterArchives key 对齐。
- 手法须可被 L2 公共锚点 + 多角色 L3 感知交叉验证（${modeProfile.label}）。

【剧透门禁 spoilerGates】
- 每幕 forbiddenFacts：该幕玩家**不可写**的结论性事实。
- ch1 最严：不得含凶手身份、核心机关全貌。

【误导 misdirections】
- 至少 3 层；surface / misleading / resolution 清晰；resolution 供 HOST 收束，非玩家本直写。

【输出 schema】
{
  "summary": "300～800 字 HOST 摘要（必填，不可少于 300 字）",
  "victim": "死者",
  "killer": "role-N",
  "method": "手法",
  "motive": "动机",
  "physicalTimeline": [{"id":"t-1","time":"相对或模糊","event":"…","participants":["role-1"]}],
  "supernaturalRules": ${isHenkaku ? '[{"rule":"…","visibility":"HOST_ONLY","observableEffect":"L2可观察现象"}]' : "[]"},
  "timeline": [{"id":"t-1","time":"…","event":"…","participants":["role-1"]}],
  "misdirections": [{"layer":1,"surface":"…","misleading":"…","resolution":"…"}],
  "spoilerGates": [{"actKey":"ch1","forbiddenFacts":["…"]}],
  "hostNotes": "主持全局备注",
  "suggestions": ["复核建议"]
}`;

  const user = `请生成 L1 真相 Bible。幕 keys：${JSON.stringify(config.chapterKeys)}。

${creativeInputUserBlocks(setting, synopsis)}
${untrustedUserPayload("规格", { playerCount: config.playerCount, chapterKeys: config.chapterKeys, matrixMode: modeProfile.key })}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
