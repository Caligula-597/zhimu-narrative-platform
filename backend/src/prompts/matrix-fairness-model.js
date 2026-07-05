/**
 * Fairness model — two layers: host clue cards + personal signature beats.
 * See examples/pending-review/雾港回声/SCORING_ZH.md §公平推理
 */

/** Facts that MUST be reachable by others (not personal flavor). */
export const INFERENCE_CRITICAL_HINTS = [
  "真凶身份",
  "核心手法全貌",
  "唯一目击作案动作",
  "核心机关完整运作"
];

/**
 * Personal signature beats — encouraged per role; NOT fairness violations when exclusive.
 * Player discovers by reading own script; may share voluntarily in play.
 */
export function buildPersonalSignatureGuidance({ roleKey, characterArchive }) {
  return {
    roleKey,
    roleName: characterArchive?.name,
    requirement:
      "本幕须含 1～2 条**特色线索/个人发现**：仅本角色剧本写到的细节（习惯、私物、独有视角、职业敏感点），供该玩家自己阅读后决定是否公聊。",
    examples: [
      "你注意到某人袖口盐渍（职业敏感）",
      "你想起登岛前收到的一封没寄出的信",
      "你的补给单上多了一行别人没有的批注"
    ],
    notFairnessViolation:
      "上述「个人专有条目」不算公平违规；违规的是「推理必需且他人永远无法触及」的核心真相。"
  };
}

export function isKillerPrivateScriptContext({ isKiller, killerAwareness, actIndex, finalActIndex }) {
  return (
    isKiller &&
    killerAwareness === "self-aware" &&
    actIndex < finalActIndex
  );
}

/** Killer self-aware private script: blunt inner voice OK; only host-facing leak matters. */
export function killerPrivateScriptSpoilerExempt({ isKiller, killerAwareness, actIndex, finalActIndex }) {
  return isKillerPrivateScriptContext({ isKiller, killerAwareness, actIndex, finalActIndex });
}
