/**
 * Matrix structured script — writing rubrics for multiplayer private scripts.
 * v5.4: psychology allowed; relative time sequence, not clock timestamps.
 */
export const WRITING_STYLE_VERSION = "v5.4-player-script";

export function buildActionStyleBlock() {
  return `【写作风格 · 经历段 · 先后叙述】
私人本需要沉浸感：写「发生了什么」，用**相对顺序**串联，不要写成监控日志。

时间：用「随后 / 这时 / 讨论开始前 / 入夜后 / 风暴稍歇时」— **禁止**每句一个精确钟点（❌ 21:05…21:06…21:07…）。
全幕至多 1～2 个模糊时间锚点即可（如「约莫入夜」），其余用先后。

动作+场景：你走进大厅 → 潮声压过人声 → 你注意到门闩完好。
本通道少写长篇内心；**细腻心理、情绪起伏**留给公聊/感受段（多人向剧本很正常）。

❌ 差：21:05 你进入。21:06 你离开。（时间写死、无文学性）
✅ 好：你随众人退回大厅。潮声未歇，你注意到陈默的箱扣半开。`;
}

export function buildDialogueStyleBlock() {
  return `【写作风格 · 公聊与心理段 · 多人私人本】
公开对话 + 你的心思、怀疑、不安 — 私人本常态。

【公平 — Matrix 2.0】
① **L2 公共池**（clueLedger + 环境）：推理主路径。
② **L3 特色线索/secret**：读本角色剧本才能发现；玩家自行决定是否公聊。
③ **L5 表层任务**不独家发放推理必需事实。
公平红线：仅当核心真相永远无法经 L2/L3 交叉获得才算违规。

❌ 公平违规：全服只有一人本写「真凶是 X 且完整手法如此」且无任何共享路径。
✅ 特色线索：「你注意到他袖口盐渍，想起上周补给单上的异常批注。」`;
}

export function buildKillerStandInStyleBlock({ actIndex, finalActIndex, killerAwareness = "self-aware" }) {
  if (actIndex >= finalActIndex) {
    return `【真凶位 · 终幕】可加强张力，但仍禁止 forbiddenFacts 与作案手法自白。`;
  }
  if (killerAwareness === "self-unaware") {
    return `【真凶位 · 不自知（ch1/ch2）】
心理描写照常；禁止：作案确证、碰凶器、担心杀人败露、内心承认「我杀了他」。
可与无辜者一样被误导、怀疑他人。`;
  }
  return `【真凶位 · 自知（ch1/ch2）· 私人本】
只有本人读这份剧本：可以**很直白** — 「我是凶手」「必须瞒住」「我清楚自己做了什么」。
这不是剧透重点（别人看不见你的本）。

对外（公聊台词）：仍撒谎、辩解、甩锅；forbiddenFacts 手法名词勿写进「会被别人听到的」段落。`;
}

export function buildWritingStyleBlock({ channel, isKiller, actIndex = 0, finalActIndex = 0, killerAwareness = "self-aware" }) {
  if (channel === "action") {
    return buildActionStyleBlock();
  }
  if (channel === "dialogue") {
    const parts = [buildDialogueStyleBlock()];
    if (isKiller && actIndex < finalActIndex) {
      parts.push(buildKillerStandInStyleBlock({ actIndex, finalActIndex, killerAwareness }));
    }
    return parts.join("\n\n");
  }
  return "";
}
