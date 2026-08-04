import { throwErr } from "../api-errors.js";

export function assertArray(value, name) {
  if (!Array.isArray(value)) throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 返回的 ${name} 不是数组`);
  return value;
}

export function uniqueKeys(items, name) {
  const keys = new Set();
  for (const item of items) {
    if (!item?.key || typeof item.key !== "string") throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 返回的 ${name} 缺少 key 字段`);
    if (keys.has(item.key)) throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 返回的 ${name} 存在重复 key：${item.key}`);
    keys.add(item.key);
  }
  return keys;
}
