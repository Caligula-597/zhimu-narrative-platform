import { normalizeDiceConfig, rollTabletopCheck } from "./tabletop-system.js";

const CHECK_MODES = new Set(["normal", "advantage", "disadvantage"]);
const CHECK_STATUSES = new Set(["pending", "resolved"]);

function cleanText(value, fallback = "", max = 240) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  return (text || fallback).slice(0, max);
}

function integer(value, min, max, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.round(Math.max(min, Math.min(max, parsed)))
    : fallback;
}

function cleanId(value, fallback = "check") {
  return cleanText(value, fallback, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function normalizeResult(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.rolls) || !value.rolls.length) return null;
  return {
    label: cleanText(value.label, "公开判定", 80),
    rollMode: CHECK_MODES.has(value.rollMode) ? value.rollMode : "normal",
    attempts: (Array.isArray(value.attempts) ? value.attempts : [])
      .slice(0, 2)
      .map((attempt) => (Array.isArray(attempt) ? attempt : []).slice(0, 10).map((roll) => integer(roll, 1, 1000, 1))),
    rolls: value.rolls.slice(0, 10).map((roll) => integer(roll, 1, 1000, 1)),
    rawTotal: integer(value.rawTotal, -9999, 9999, 0),
    total: integer(value.total, -9999, 9999, 0),
    target: integer(value.target, -9999, 9999, 0),
    success: Boolean(value.success),
    criticalSuccess: Boolean(value.criticalSuccess),
    criticalFailure: Boolean(value.criticalFailure),
    margin: integer(value.margin, -9999, 9999, 0),
    degree: cleanText(value.degree, value.success ? "success" : "failure", 40),
    degreeLabel: cleanText(value.degreeLabel, value.success ? "成功" : "失败", 40),
    degreeRank: integer(value.degreeRank, -9, 9, value.success ? 1 : -1)
  };
}

export function normalizeTabletopCheckTemplate(value = {}, { defaultTarget = 12, index = 0 } = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    id: cleanId(source.id, `check-${index + 1}`),
    label: cleanText(source.label, `地点判定 ${index + 1}`, 80),
    instruction: cleanText(source.instruction, "描述行动方式后进行判定。", 240),
    target: integer(source.target, -9999, 9999, defaultTarget),
    bonus: integer(source.bonus, -999, 999, 0),
    rollMode: CHECK_MODES.has(source.rollMode) ? source.rollMode : "normal",
    successText: cleanText(source.successText, "判定成功，获得预期进展。", 240),
    failureText: cleanText(source.failureText, "判定失败，但故事仍可带着代价继续。", 240)
  };
}

export function normalizeRuntimeTabletopCheck(value, { defaultDice = {}, locationIds = null } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = normalizeResult(value.result);
  const locationId = cleanId(value.locationId, "");
  if (locationIds instanceof Set && locationId && !locationIds.has(locationId)) return null;
  const status = CHECK_STATUSES.has(value.status) ? value.status : result ? "resolved" : "pending";
  return {
    id: cleanId(value.id, "active-check"),
    templateId: cleanId(value.templateId, ""),
    locationId,
    label: cleanText(value.label, "公开判定", 80),
    instruction: cleanText(value.instruction, "描述行动方式，等待主持人公开掷骰。", 240),
    target: integer(value.target, -9999, 9999, 12),
    bonus: integer(value.bonus, -999, 999, 0),
    rollMode: CHECK_MODES.has(value.rollMode) ? value.rollMode : "normal",
    dice: normalizeDiceConfig(value.dice || defaultDice),
    status: status === "resolved" && !result ? "pending" : status,
    result,
    successText: cleanText(value.successText, "判定成功，获得预期进展。", 240),
    failureText: cleanText(value.failureText, "判定失败，但故事仍可带着代价继续。", 240),
    outcomeText: result
      ? cleanText(value.outcomeText, result.success ? value.successText : value.failureText, 240)
      : "",
    startedAt: cleanText(value.startedAt, "", 40),
    resolvedAt: result ? cleanText(value.resolvedAt, "", 40) : ""
  };
}

export function createRuntimeTabletopCheck(template = {}, {
  locationId = "",
  dice = {},
  now = () => new Date().toISOString(),
  id = ""
} = {}) {
  const normalizedDice = normalizeDiceConfig(dice);
  const check = normalizeTabletopCheckTemplate(template, { defaultTarget: normalizedDice.defaultTarget });
  return normalizeRuntimeTabletopCheck({
    ...check,
    id: id || `check-${Date.now().toString(36)}`,
    templateId: check.id,
    locationId,
    dice: normalizedDice,
    status: "pending",
    result: null,
    startedAt: now()
  }, { defaultDice: normalizedDice });
}

export function resolveRuntimeTabletopCheck(value, {
  random = Math.random,
  now = () => new Date().toISOString()
} = {}) {
  const check = normalizeRuntimeTabletopCheck(value);
  if (!check) return null;
  if (check.status === "resolved" && check.result) return check;
  const result = rollTabletopCheck(check.dice, {
    label: check.label,
    target: check.target,
    bonus: check.bonus,
    rollMode: check.rollMode
  }, random);
  return normalizeRuntimeTabletopCheck({
    ...check,
    status: "resolved",
    result,
    outcomeText: result.success ? check.successText : check.failureText,
    resolvedAt: now()
  });
}

export function projectRuntimeTabletopCheck(value, { audience = "player" } = {}) {
  const check = normalizeRuntimeTabletopCheck(value);
  if (!check) return null;
  if (audience !== "player") return check;
  const { successText: _successText, failureText: _failureText, ...publicCheck } = check;
  return publicCheck;
}
