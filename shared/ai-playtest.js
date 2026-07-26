export const AI_PLAYER_ARCHETYPES = {
  logical: {
    label: "逻辑型",
    short: "逻",
    description: "重建时间线，验证因果并排除替代解释"
  },
  emotional: {
    label: "情感型",
    short: "情",
    description: "优先理解关系、动机和情绪变化"
  },
  social: {
    label: "社交型",
    short: "社",
    description: "主动交换信息、结盟和追问"
  },
  silent: {
    label: "沉默型",
    short: "默",
    description: "很少主动分享，只在必要时表达判断"
  },
  skeptic: {
    label: "极度怀疑型",
    short: "疑",
    description: "持续寻找反证，质疑显眼答案"
  },
  dominant: {
    label: "抢话型",
    short: "抢",
    description: "快速定调并推动行动，可能压过不同意见"
  },
  secretive: {
    label: "保密型",
    short: "秘",
    description: "保护私人目标，谨慎权衡是否共享"
  },
  skimmer: {
    label: "跳读型",
    short: "略",
    description: "依赖显眼描述，容易遗漏时间与限定词"
  },
  brute_force: {
    label: "暴力破解型",
    short: "破",
    description: "枚举答案并尝试跳过中间推理"
  },
  wanderer: {
    label: "偏航型",
    short: "偏",
    description: "容易追逐支线，测试主线恢复能力"
  }
};

export const AI_PLAYER_ARCHETYPE_IDS = Object.freeze(Object.keys(AI_PLAYER_ARCHETYPES));
