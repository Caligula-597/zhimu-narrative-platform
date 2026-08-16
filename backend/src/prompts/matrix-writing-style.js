/**
 * Matrix structured script — writing rubrics for multiplayer private scripts.
 * v5.5: psychology allowed; relative time; speech naturalness via matrix-speech-style.
 */
import {
  buildAntiAiNarrationBlock,
  buildAntiMontageBlock,
  buildKillerChaosPovBlock,
  buildSensoryExpressionBlock
} from "./matrix-speech-style.js";

export const WRITING_STYLE_VERSION = "v5.6-expressive";

export function buildActionStyleBlock(characterArchive = null) {
  return `${buildAntiMontageBlock()}

${buildSensoryExpressionBlock(characterArchive)}

${buildAntiAiNarrationBlock()}

【写作风格 · 经历段 · 先后叙述】
私人本需要沉浸感：写「发生了什么」，用**相对顺序**串联，不要写成监控日志。

时间：用「随后 / 这时 / 讨论开始前 / 入夜后 / 风暴稍歇时」— **禁止**每句一个精确钟点（❌ 21:05…21:06…21:07…）。
全幕至多 1～2 个模糊时间锚点即可（如「约莫入夜」），其余用先后。

动作+场景：只使用当前幕已登记的地点、环境与可见物，把动作和观察连成因果。
本通道少写长篇内心；**细腻心理、情绪起伏**留给公聊/感受段（多人向剧本很正常）。

不要把一连串精确钟点写成流水账，也不要为了文学性新增当前故事没有的人、物或地点。`;
}

export function buildDialogueStyleBlock() {
  return `【写作风格 · 公聊与心理段 · 多人私人本】
公开对话 + 你的心思、怀疑、不安 — 私人本常态。

【公平 — Matrix 2.0】
① **L2 授权线索**（本角色已取得的 clueLedger + 公共环境）：可包含主路径或局部关系线索；不得默认全员可见。
② **L3 特色线索/secret**：读本角色剧本才能发现；玩家自行决定是否公聊。
③ **L5 表层任务**不独家发放推理必需事实。
公平红线：仅当核心真相永远无法经 L2/L3 交叉获得才算违规。

核心结论必须存在共享或交叉验证路径；特色线索只能使用当前矩阵已登记的事实。`;
}

export function buildKillerStandInStyleBlock({ actIndex, finalActIndex, killerAwareness = "self-aware" }) {
  if (actIndex >= finalActIndex) {
    return `【真凶位 · 终幕】可加强张力，但仍禁止 forbiddenFacts 与作案手法自白。`;
  }
  if (killerAwareness === "self-unaware") {
    return `【真凶位 · 不自知（ch1/ch2）】
心理用感官写紧张；禁止：作案确证、碰凶器、担心杀人败露、内心承认「我杀了他」。
可与无辜者一样被误导、怀疑他人。`;
  }
  return `【真凶位 · 自知（ch1/ch2）· 混沌非报告】
只有本人读这份剧本：可以知道自己**做了亏心事**，但写法是**当下慌乱**——手抖、记不清钟点、不敢确认物证。
禁止写成事后结案：「我确实试图毒死他但未成功」「我清楚自己做了什么」。
对外（公聊台词）：仍撒谎、辩解、甩锅；forbiddenFacts 手法名词勿写进会被听到的段落。`;
}

export function buildWritingStyleBlock({
  channel,
  isKiller,
  actIndex = 0,
  finalActIndex = 0,
  killerAwareness = "self-aware",
  characterArchive = null
}) {
  if (channel === "action") {
    return buildActionStyleBlock(characterArchive);
  }
  if (channel === "dialogue") {
    const parts = [buildDialogueStyleBlock(), buildSensoryExpressionBlock(characterArchive)];
    if (isKiller && actIndex < finalActIndex) {
      parts.push(buildKillerStandInStyleBlock({ actIndex, finalActIndex, killerAwareness }));
      parts.push(buildKillerChaosPovBlock({ actIndex, finalActIndex }));
    }
    return parts.join("\n\n");
  }
  return "";
}
