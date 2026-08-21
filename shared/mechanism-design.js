import {
  DEFAULT_MECHANISM_INTERACTION_KIND,
  isMechanismInteractionKind,
  mechanismInteractionCard,
} from "./mechanism-interactions.js";
import { isMechanismKitKey } from "./mechanism-catalog.js";

export const MECHANISM_DESIGN_VERSION = 1;
export const MECHANISM_DESIGN_STATUSES = Object.freeze(["draft", "confirmed"]);

export const MECHANISM_DESIGN_QUESTIONS = Object.freeze([
  Object.freeze({
    key: "recurringAction",
    label: "玩家反复执行的动作",
    prompt: "写具体动作，例如调取一份档案、分配氧气或提出仲裁动议。",
  }),
  Object.freeze({
    key: "conflictReason",
    label: "为什么不能全部合作",
    prompt: "说明目标、权限、信息或利益为什么互相冲突。",
  }),
  Object.freeze({
    key: "limitedResource",
    label: "题材内有限资源",
    prompt: "写世界中真实存在的名额、时间、权限、物资或机会。",
  }),
  Object.freeze({
    key: "immediateFeedback",
    label: "选择后的即时反馈",
    prompt: "玩家行动后立刻看见什么变化。",
  }),
  Object.freeze({
    key: "failureAdvance",
    label: "失败如何继续推进",
    prompt: "失败不能停局；写明损失、替代路径或新的危险。",
  }),
  Object.freeze({
    key: "genreSpecificity",
    label: "为什么只适合这个题材",
    prompt: "说明它怎样利用本作独有的职业、制度、空间或世界规则。",
  }),
  Object.freeze({
    key: "endingCausality",
    label: "早期选择怎样影响结局",
    prompt: "指出前几轮选择会改变的路线、资源或人物关系。",
  }),
]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function cleanText(value, maximum = 2400) {
  return String(value ?? "")
    .trim()
    .slice(0, maximum);
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

export function normalizeMechanismDesign(value = {}) {
  const source = record(value);
  const interactionKind = isMechanismInteractionKind(source.interactionKind)
    ? String(source.interactionKind)
    : DEFAULT_MECHANISM_INTERACTION_KIND;
  const status = MECHANISM_DESIGN_STATUSES.includes(source.status)
    ? source.status
    : "draft";
  return {
    version: MECHANISM_DESIGN_VERSION,
    templateKey: isMechanismKitKey(source.templateKey)
      ? String(source.templateKey).trim()
      : "",
    interactionKind,
    allocationTotal: boundedInteger(source.allocationTotal, 100, 1, 10_000),
    allocationUnitLabel: cleanText(source.allocationUnitLabel, 40) || "点",
    title: cleanText(source.title, 160),
    summary: cleanText(source.summary, 1200),
    recurringAction: cleanText(source.recurringAction),
    conflictReason: cleanText(source.conflictReason),
    limitedResource: cleanText(source.limitedResource),
    immediateFeedback: cleanText(source.immediateFeedback),
    failureAdvance: cleanText(source.failureAdvance),
    genreSpecificity: cleanText(source.genreSpecificity),
    endingCausality: cleanText(source.endingCausality),
    authorNotes: cleanText(source.authorNotes, 4000),
    status,
    updatedAt: cleanText(source.updatedAt, 80),
  };
}

export function mechanismDesignCoverage(value = {}) {
  const design = normalizeMechanismDesign(value);
  const filledKeys = MECHANISM_DESIGN_QUESTIONS.map(
    (question) => question.key,
  ).filter((key) => Boolean(design[key]));
  return {
    filled: filledKeys.length,
    total: MECHANISM_DESIGN_QUESTIONS.length,
    score: Math.round(
      (filledKeys.length / MECHANISM_DESIGN_QUESTIONS.length) * 100,
    ),
    complete: filledKeys.length === MECHANISM_DESIGN_QUESTIONS.length,
    missingKeys: MECHANISM_DESIGN_QUESTIONS.map(
      (question) => question.key,
    ).filter((key) => !filledKeys.includes(key)),
  };
}

export function mechanismDesignHasContent(value = {}) {
  const design = normalizeMechanismDesign(value);
  return Boolean(
    design.title ||
      design.summary ||
      design.authorNotes ||
      MECHANISM_DESIGN_QUESTIONS.some((question) => design[question.key]),
  );
}

export function validateMechanismDesignConfirmation(value = {}) {
  const design = normalizeMechanismDesign(value);
  const issues = [];
  if (!design.title) {
    issues.push({
      key: "title",
      message: "请填写机制名称，主持端和玩家端都会用它识别本机制。",
    });
  }
  if (!design.summary) {
    issues.push({
      key: "summary",
      message: "请填写一句话概述，说明玩家如何行动以及选择会改变什么。",
    });
  }
  for (const question of MECHANISM_DESIGN_QUESTIONS) {
    if (!design[question.key]) {
      issues.push({
        key: question.key,
        message: `请回答「${question.label}」。`,
      });
    }
  }
  return {
    valid: issues.length === 0,
    issues,
    design,
    coverage: mechanismDesignCoverage(design),
  };
}

export function formatMechanismDesignForPrompt(value = {}) {
  const design = normalizeMechanismDesign(value);
  const coverage = mechanismDesignCoverage(design);
  if (!coverage.filled && !design.title && !design.summary) return [];
  const card = mechanismInteractionCard(design.interactionKind);
  const rows = [
    `设计状态：${design.status === "confirmed" ? "作者已确认" : "作者草稿，不得擅自补成既定事实"}`,
    `线上表现：${card.label}`,
    design.interactionKind === "numeric_allocation"
      ? `每位玩家可分配：${design.allocationTotal} ${design.allocationUnitLabel}`
      : "",
    design.title ? `机制名称：${design.title}` : "",
    design.summary ? `机制概述：${design.summary}` : "",
    ...MECHANISM_DESIGN_QUESTIONS.map((question) =>
      design[question.key] ? `${question.label}：${design[question.key]}` : "",
    ),
    design.authorNotes ? `作者备注：${design.authorNotes}` : "",
  ];
  return rows.filter(Boolean);
}
