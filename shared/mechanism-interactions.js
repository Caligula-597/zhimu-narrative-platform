/**
 * Cross-surface presentation contract for authored mechanism decisions.
 *
 * The runtime remains authoritative and deterministic.  This module only
 * describes how the same decision should be explained to an author, operated
 * by a host and presented to players.  Adding a new kind must therefore start
 * here instead of growing three unrelated UI switches.
 */

export const DEFAULT_MECHANISM_INTERACTION_KIND = "group_choice";
export const MECHANISM_INTERACTION_RESOLUTION = "host_confirmed";
export const MECHANISM_INTERACTION_SUBMISSION_MODE = "advisory_choice";
export const MECHANISM_INTERACTION_SUBMISSION_MODES = Object.freeze([
  "advisory_choice",
  "private_choice",
]);

export const MECHANISM_INTERACTION_CARDS = Object.freeze([
  Object.freeze({
    key: "group_choice",
    label: "公开抉择",
    shortLabel: "讨论",
    theme: "discussion",
    authorPrompt: "全桌公开讨论并形成唯一选择。",
    playerInstruction: "讨论方案后，把全桌决定交给主持人。",
    hostInstruction: "确认全桌决定后结算，不替玩家选择。",
  }),
  Object.freeze({
    key: "resource_tradeoff",
    label: "资源取舍",
    shortLabel: "分配",
    theme: "resource",
    authorPrompt: "用有限资源交换区域、权限、时间或安全。",
    playerInstruction: "比较每个方案会消耗和保住什么。",
    hostInstruction: "核对剩余资源；不足时执行失败推进。",
  }),
  Object.freeze({
    key: "evidence_selection",
    label: "证据质证",
    shortLabel: "质证",
    theme: "evidence",
    authorPrompt: "选择认可、公开、封存或组合哪组材料。",
    playerInstruction: "核对材料边界，再选择证据方案。",
    hostInstruction: "只按已取得且有效的证据结算。",
  }),
  Object.freeze({
    key: "sequence_reconstruction",
    label: "顺序重建",
    shortLabel: "排序",
    theme: "sequence",
    authorPrompt: "重建事件、档案、语言或行动顺序。",
    playerInstruction: "比较各套顺序，再提交完整方案。",
    hostInstruction: "结算整套方案，不逐条发放答案。",
  }),
  Object.freeze({
    key: "timed_crisis",
    label: "限时危机",
    shortLabel: "限时",
    theme: "timed",
    authorPrompt: "时限内行动，超时也产生可继续的结果。",
    playerInstruction: "在时限内行动；到期执行默认损失。",
    hostInstruction: "按作品时钟结算，不临时延长。",
  }),
  Object.freeze({
    key: "role_commitment",
    label: "角色承诺",
    shortLabel: "承诺",
    theme: "role",
    authorPrompt: "角色承诺会改变自身权限、关系或路线。",
    playerInstruction: "按角色目标选择愿意承担的立场。",
    hostInstruction: "确认承诺主体并记录后续影响。",
  }),
]);

const CARD_BY_KEY = new Map(
  MECHANISM_INTERACTION_CARDS.map((card) => [card.key, card]),
);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function cleanText(value, maxLength = 600) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function cleanKey(value) {
  return cleanText(value, 120);
}

function boundedInteger(value, fallback = 0, minimum = 0, maximum = 7200) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function submissionModeFor(card) {
  return card.key === "role_commitment"
    ? "private_choice"
    : MECHANISM_INTERACTION_SUBMISSION_MODE;
}

export function mechanismInteractionCard(
  kind = DEFAULT_MECHANISM_INTERACTION_KIND,
) {
  return (
    CARD_BY_KEY.get(kind) || CARD_BY_KEY.get(DEFAULT_MECHANISM_INTERACTION_KIND)
  );
}

export function isMechanismInteractionKind(kind) {
  return CARD_BY_KEY.has(String(kind ?? "").trim());
}

export function normalizeMechanismInteraction(value = {}) {
  const source = record(value);
  const card = mechanismInteractionCard(cleanKey(source.kind));
  return {
    kind: card.key,
    resolutionMode: MECHANISM_INTERACTION_RESOLUTION,
    submissionMode: submissionModeFor(card),
    label: cleanText(source.label, 120) || card.label,
    playerInstruction:
      cleanText(source.playerInstruction) || card.playerInstruction,
    hostInstruction: cleanText(source.hostInstruction) || card.hostInstruction,
    deadlineSeconds:
      card.key === "timed_crisis"
        ? boundedInteger(source.deadlineSeconds, 0, 0, 7200)
        : 0,
    defaultOptionKey:
      card.key === "timed_crisis" ? cleanKey(source.defaultOptionKey) : "",
    resourceKey:
      card.key === "resource_tradeoff" ? cleanKey(source.resourceKey) : "",
  };
}

export function normalizeMechanismOptionPresentation(value = {}) {
  const source = record(value);
  return {
    eyebrow: cleanText(source.eyebrow, 80),
    publicPreview: cleanText(source.publicPreview, 500),
    costLabel: cleanText(source.costLabel, 160),
    riskLabel: cleanText(source.riskLabel, 160),
    sequenceLabel: cleanText(source.sequenceLabel, 80),
  };
}

export function publicMechanismInteraction(value = {}) {
  const interaction = normalizeMechanismInteraction(value);
  return {
    kind: interaction.kind,
    resolutionMode: interaction.resolutionMode,
    submissionMode: interaction.submissionMode,
    label: interaction.label,
    playerInstruction: interaction.playerInstruction,
    deadlineSeconds: interaction.deadlineSeconds,
    defaultOptionKey: interaction.defaultOptionKey,
  };
}
