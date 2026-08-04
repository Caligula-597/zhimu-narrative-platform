/** Small normalization primitives; deliberately free of outline policy. */

import { cleanText } from "../prompts/shared.js";
import { GENERIC_ACTION_ONLY, GENERIC_EFFECT_ONLY } from "./constants.js";

export function list(value) {
  return Array.isArray(value) ? value : [];
}

export function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function text(value, max = 2000) {
  return cleanText(value, max);
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function uniqueScalars(values) {
  const rows = [];
  const seen = new Set();
  for (const value of values.filter(hasScalarValue)) {
    const signature = stateValueSignature(value);
    if (seen.has(signature)) continue;
    seen.add(signature);
    rows.push(value);
  }
  return rows;
}

export function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values.filter(Boolean)) {
    const normalized = value.toLocaleLowerCase("zh-CN");
    if (seen.has(normalized)) duplicates.add(value);
    seen.add(normalized);
  }
  return [...duplicates];
}

export function requireText(value, label, issues, min = 2) {
  if (text(value).length < min) issues.push(`${label} 缺失或过短`);
}

export function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function scalarValue(value, max = 160) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return text(value, max);
}

export function hasScalarValue(value) {
  return value !== "" && value !== null && value !== undefined;
}

export function stateValueSignature(value) {
  return `${typeof value}:${JSON.stringify(value)}`;
}

export function chapterIndex(chapterKeys, chapterKey) {
  return chapterKeys.indexOf(chapterKey);
}

export function normalizedAction(value) {
  return text(value, 1200)
    .toLocaleLowerCase("zh-CN")
    .replace(/角色|玩家|众人|全员|主动|继续|开始|尝试|决定|选择|共同|分别|再次/gu, "")
    .replace(/[\s，。、“”‘’：:；;（）()《》【】\-_]/gu, "");
}

export function isGenericAction(value) {
  const normalized = text(value, 1200);
  return normalized.length < 8 || GENERIC_ACTION_ONLY.test(normalized);
}

export function isGenericEffect(value) {
  const normalized = text(value, 1200);
  return normalized.length < 8 || GENERIC_EFFECT_ONLY.test(normalized);
}

export function requireKnownRefs(refs, known, label, issues, min = 0) {
  const normalized = unique(list(refs).map((item) => text(item, 80)));
  if (normalized.length < min) issues.push(`${label} 至少需要 ${min} 项`);
  for (const ref of normalized) if (!known.has(ref)) issues.push(`${label} 引用了不存在的 key：${ref}`);
  return normalized;
}
