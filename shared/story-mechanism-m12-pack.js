/**
 * M12 Story Content Pack V1 — 关系议价 / Relationship Bargain
 *
 * P10.3：补齐 RELATIONSHIP_BARGAIN + NEGOTIATE/EXCHANGE + player-caused OWNERSHIP_SHIFT。
 * 非 FACTION、非 CRIME；resolutionPressure = OPEN。
 * 仅数据：无专用 producer。
 */

function editableFromSlots(roleSlots, plotSlots) {
  return [
    ...Object.entries(roleSlots).map(([id, slot]) => ({
      id,
      key: id,
      label: slot.label || id,
      type: "CHARACTER",
      kind: "role",
      actions: ["SWAP", "EDIT"],
      locked: false,
    })),
    ...Object.entries(plotSlots).map(([id, slot]) => ({
      id,
      key: id,
      label: slot.label || id,
      type: slot.type || "TEXT_OR_PRESET",
      kind: "plot",
      actions: ["SWAP", "EDIT", "REGENERATE"],
      locked: false,
    })),
  ];
}

function freezeTemplate(tpl) {
  return Object.freeze({
    ...tpl,
    roleSlots: Object.freeze(tpl.roleSlots),
    plotSlots: Object.freeze(tpl.plotSlots),
    clueSlots: Object.freeze(tpl.clueSlots),
    stagePattern: Object.freeze(tpl.stagePattern),
    variants: Object.freeze(tpl.variants.map((v) => Object.freeze(v))),
    constraints: Object.freeze(tpl.constraints || []),
    defaultGeneration: Object.freeze(tpl.defaultGeneration || { preferredVariantId: tpl.variants[0]?.id }),
    editableSlots: Object.freeze(editableFromSlots(tpl.roleSlots, tpl.plotSlots)),
    integrationHints: Object.freeze(tpl.integrationHints || {}),
    contentMaturity: "COMPLETE",
    familyId: "M12",
  });
}

function variant(spec) {
  return {
    requiredSlots: spec.requiredSlots || ["bargainA", "bargainB"],
    preferredSlots: spec.preferredSlots || ["stakeholder"],
    incompatibilities: spec.incompatibilities || [],
    recommendedCluePattern: spec.recommendedCluePattern || ["STAKE_HINT", "TERM_LEAK", "TRANSFER_PROOF"],
    revealPattern: spec.revealPattern || "negotiated",
    consequencePattern: spec.consequencePattern || "ownership_shift",
    defaults: spec.defaults || {},
    ...spec,
  };
}

const STAGE = Object.freeze([
  { id: "PROBE", stageRole: "SETUP", ordering: 0, optional: false, label: "试探开价" },
  { id: "NEGOTIATE", stageRole: "DEVELOP", ordering: 1, optional: false, label: "条件谈判" },
  { id: "EXCHANGE", stageRole: "TURN", ordering: 2, optional: false, label: "交换换手" },
  { id: "AFTERMATH", stageRole: "RESOLVE", ordering: 3, optional: false, label: "换手后果" },
]);

const CLUES = Object.freeze([
  { id: "STAKE_HINT", type: "FORESHADOW", purpose: "标的存在暗示", required: true, stageHint: "PROBE" },
  { id: "TERM_LEAK", type: "IDENTITY_HINT", purpose: "对方底线/条件外泄", required: true, stageHint: "NEGOTIATE" },
  { id: "TRANSFER_PROOF", type: "CONFIRMATION", purpose: "换手完成凭证", required: true, stageHint: "EXCHANGE" },
]);

const ROLE_SLOTS = Object.freeze({
  bargainA: {
    required: true,
    label: "需求方",
    allowNpc: false,
    mustDifferFrom: ["bargainB"],
    preferredLoad: "high",
    allowedOverlap: true,
    narrativeRole: "seeker",
    intensity: 2,
  },
  bargainB: {
    required: true,
    label: "掌握方",
    allowNpc: false,
    mustDifferFrom: ["bargainA"],
    preferredLoad: "high",
    allowedOverlap: true,
    narrativeRole: "holder",
    intensity: 2,
  },
  stakeholder: {
    required: false,
    label: "利害相关者",
    allowNpc: false,
    mustDifferFrom: ["bargainA", "bargainB"],
    preferredLoad: "medium",
    allowedOverlap: true,
    narrativeRole: "stakeholder",
    intensity: 1,
  },
  witness: {
    required: false,
    label: "见证者",
    allowNpc: true,
    mustDifferFrom: [],
    preferredLoad: "low",
    narrativeRole: "witness",
    intensity: 1,
  },
});

const PLOT_SLOTS = Object.freeze({
  contestedStake: {
    id: "contestedStake",
    label: "争夺标的（资源/信息/权利）",
    type: "TEXT_OR_PRESET",
    required: true,
    presets: [
      "一份未公开的名录或通行权限",
      "可改变他人处境的关键物件",
      "一段只有掌握方能证实的信息",
    ],
    generationHint: "写具体可换手的东西，不要写抽象‘真相’",
  },
  initialOwner: {
    id: "initialOwner",
    label: "开场掌握方",
    type: "TEXT_OR_PRESET",
    required: true,
    presets: ["bargainB 独占", "bargainB 与第三方共管，实际控制在 bargainB"],
  },
  seekerNeed: {
    id: "seekerNeed",
    label: "需求方要它的理由",
    type: "TEXT_OR_PRESET",
    required: true,
    presets: ["保护自己或盟友", "换取另一项关键承诺", "阻止对方滥用"],
  },
  holderPrice: {
    id: "holderPrice",
    label: "掌握方开出的代价",
    type: "TEXT_OR_PRESET",
    required: true,
    presets: ["公开一个秘密", "转让另一项小权限", "站队或背书"],
  },
  exchangeTerms: {
    id: "exchangeTerms",
    label: "可成交的交换条件",
    type: "TEXT_OR_PRESET",
    required: true,
    presets: ["信息换物件", "承诺换权限", "作证换免责"],
  },
  afterOwner: {
    id: "afterOwner",
    label: "换手后的新掌握方",
    type: "TEXT_OR_PRESET",
    required: true,
    presets: ["bargainA 独占", "双方共持但权限翻转", "stakeholder 临时代管"],
  },
  aftermathChoice: {
    id: "aftermathChoice",
    label: "换手后被迫重谈的关系选择",
    type: "TEXT_OR_PRESET",
    required: true,
    presets: ["是否公开交换事实", "是否继续合作", "是否撕毁原承诺"],
  },
});

export function buildM12CompleteTemplates() {
  const tpl = freezeTemplate({
    id: "M12-1",
    title: "双边关系议价",
    purpose:
      "让两名（或多名）玩家围绕具体标的进行试探、隐瞒、谈判与交换；玩家行为造成 owner/access/knowledge 真实换手，并改变后续选择。",
    description:
      "关系博弈骨架：非阵营、非推凶。标的必须具体；换手必须由玩家行动完成，旁白转移不算。",
    roleSlots: ROLE_SLOTS,
    plotSlots: PLOT_SLOTS,
    clueSlots: CLUES,
    stagePattern: STAGE,
    variants: [
      variant({
        id: "V01",
        title: "信息换权限",
        description: "掌握方握有关键信息/名录；需求方以承诺或另一信息换取访问权。",
        defaults: {
          contestedStake: "一份未公开的名录或通行权限",
          initialOwner: "bargainB 独占",
          seekerNeed: "保护自己或盟友",
          holderPrice: "公开一个秘密",
          exchangeTerms: "信息换物件",
          afterOwner: "bargainA 独占",
          aftermathChoice: "是否公开交换事实",
        },
      }),
      variant({
        id: "V02",
        title: "物件换站队",
        description: "掌握方握有关键物件；需求方以关系站队或背书换取物件。",
        defaults: {
          contestedStake: "可改变他人处境的关键物件",
          initialOwner: "bargainB 独占",
          seekerNeed: "阻止对方滥用",
          holderPrice: "站队或背书",
          exchangeTerms: "承诺换权限",
          afterOwner: "双方共持但权限翻转",
          aftermathChoice: "是否继续合作",
        },
      }),
    ],
    constraints: [
      { type: "distinct_roles", slots: ["bargainA", "bargainB"] },
      { type: "player_caused_transfer", summary: "换手必须由玩家谈判/交换行动完成，不得仅旁白转移" },
      { type: "concrete_stake", summary: "标的必须是具体资源/信息/权利，不得抽象成‘真相’" },
      { type: "open_resolution", summary: "不得强制收束为唯一凶手或阵营胜负" },
    ],
    defaultGeneration: { preferredVariantId: "V01" },
    integrationHints: {
      canPrecede: ["M07", "M10"],
      canFollow: ["M07", "M10"],
      sharesFactsWith: ["stake", "ownership", "bargain"],
    },
  });
  return Object.freeze([tpl]);
}

export const M12_TEMPLATE_IDS = Object.freeze(["M12-1"]);
