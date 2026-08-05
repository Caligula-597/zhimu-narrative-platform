/**
 * Matrix 2.0 — entity token unlock schedule (专名解锁序).
 * Aligns script prompts, quality gates, studio graph, and clue library.
 */
import { actIndex } from "./matrix-prompt-engine.js";
import { cleanText } from "./shared.js";

/**
 * Optional aliases for common entity tokens.
 *
 * This is an alias dictionary, not a catalogue of entities that every story owns.
 * Tokens enter a story's unlock schedule only when an actual clue mentions them.
 */
export const ENTITY_TOKEN_REGISTRY = {
  钥匙胚: { aliases: ["未打磨铜坯", "备用铜坯", "备用钥匙坯"], personalEarly: true },
  暗格: { aliases: ["底板盖板", "检修活门", "地板活门", "检修口"] },
  检修暗格: { aliases: ["底板盖板", "检修活门", "旋转机构底部开口"] },
  细线: { aliases: ["门缝里的线", "细绳", "尼龙线"] },
  旋转开关: { aliases: ["机构开关", "限位器"] },
  限位器: { aliases: ["旋转限位", "机构限位"] },
  钥匙: { aliases: ["钥匙串", "备用钥匙"] },
  走私: { aliases: ["违规通讯", "私改频率"] },
  机关: { aliases: ["机构", "机械装置"] },
  违规记录: { aliases: ["异常记录", "私改记录"] },
  频率干扰: { aliases: ["信号异常", "电台杂音"] }
};

const SCAN_TOKENS = Object.keys(ENTITY_TOKEN_REGISTRY);

function tokensFromClue(clue) {
  const flat = `${clue?.name || ""}${clue?.description || ""}`.replace(/\s/g, "");
  const found = SCAN_TOKENS.filter((t) => flat.includes(t.replace(/\s/g, "")));
  if (clue?.name) {
    const name = clue.name.replace(/\s/g, "");
    if (!found.some((t) => name.includes(t))) found.push(clue.name.replace(/\s/g, "").slice(0, 8));
  }
  return [...new Set(found)];
}

/**
 * @param {object} infoMatrix
 * @param {object} config
 */
export function buildEntityUnlockSchedule(infoMatrix, config) {
  const entries = [];

  for (const clue of infoMatrix?.clues || []) {
    const unlockActIndex = actIndex(config, clue.actKey);
    const tokens = tokensFromClue(clue);
    for (const token of tokens) {
      const reg = ENTITY_TOKEN_REGISTRY[token] || { aliases: ["相关物证"], personalEarly: false };
      const existing = entries.find((e) => e.token === token);
      if (existing) {
        existing.unlockActIndex = Math.min(existing.unlockActIndex, unlockActIndex);
        existing.clueKeys.add(clue.key);
      } else {
        entries.push({
          token,
          unlockActKey: clue.actKey,
          unlockActIndex,
          clueKeys: new Set([clue.key]),
          aliases: reg.aliases || [],
          personalEarly: Boolean(reg.personalEarly),
          grantMode: clue.grantMode || "auto",
          source: clue.source || "ClueCard"
        });
      }
    }
  }

  return entries
    .map((e) => ({ ...e, clueKeys: [...e.clueKeys] }))
    .sort((a, b) => a.unlockActIndex - b.unlockActIndex || a.token.localeCompare(b.token, "zh-CN"));
}

export function isEntityTokenUnlocked(token, actKey, config, schedule) {
  const actIdx = actIndex(config, actKey);
  const entry = (schedule || []).find((e) => e.token === token);
  if (!entry) return true;
  return actIdx >= entry.unlockActIndex;
}

export function substituteEarlyEntityAliases(text, actKey, config, schedule) {
  let out = String(text || "");
  const actIdx = actIndex(config, actKey);
  for (const entry of schedule || []) {
    if (actIdx >= entry.unlockActIndex) continue;
    if (!entry.token || !out.includes(entry.token)) continue;
    const alias = entry.aliases?.[0] || "相关物证";
    out = out.split(entry.token).join(alias);
  }
  return out;
}

export function formatEntityUnlockPromptBlock(actKey, config, schedule) {
  const actIdx = actIndex(config, actKey);
  const lines = ["【专名解锁序 · 本幕及之前可用专名】"];
  const unlocked = (schedule || []).filter((e) => actIdx >= e.unlockActIndex);
  const locked = (schedule || []).filter((e) => actIdx < e.unlockActIndex);

  if (unlocked.length) {
    lines.push("已解锁（可写专名）：" + unlocked.map((e) => e.token).join("、"));
  }
  if (locked.length) {
    lines.push(
      "未解锁（公聊/心理段禁止专名，改用指代）：",
      ...locked.map((e) => `- 「${e.token}」→ ${(e.aliases || ["某物"]).join(" / ")}（${e.unlockActKey} 线索卡解锁）`)
    );
  }
  if (locked.some((e) => e.personalEarly)) {
    lines.push("个人 secret 可在经历段提及「自己的」未解锁物，但公聊段仍用指代。");
  }
  return lines.join("\n");
}

export function buildEntityUnlockContract(infoMatrix, actKey, config) {
  const schedule = buildEntityUnlockSchedule(infoMatrix, config);
  return {
    actKey,
    actIndex: actIndex(config, actKey),
    schedule,
    promptBlock: formatEntityUnlockPromptBlock(actKey, config, schedule)
  };
}

export function scanDialogueEntities(text, authorizedClueNames, options = {}) {
  const { actKey, config, schedule, personalEarlyInAction = false, channel = "dialogue" } = options;
  const authorized = new Set((authorizedClueNames || []).map((n) => n.replace(/\s/g, "")));
  const violations = [];
  const flat = String(text || "");
  const actIdx = config && actKey ? actIndex(config, actKey) : 999;

  for (const token of SCAN_TOKENS) {
    if (!flat.includes(token)) continue;
    const entry = (schedule || []).find((e) => e.token === token);
    const unlocked = entry ? actIdx >= entry.unlockActIndex : true;
    const okByClue = [...authorized].some(
      (name) => name.includes(token.replace(/\s/g, "")) || token.includes(name)
    );
    if (okByClue || unlocked) continue;
    if (personalEarlyInAction && channel === "action" && entry?.personalEarly) continue;
    violations.push({
      type: "unauthorizedEntity",
      token,
      unlockActKey: entry?.unlockActKey,
      suggestedAlias: entry?.aliases?.[0]
    });
  }
  return { passed: violations.length === 0, violations };
}

export function serializeEntitySchedule(schedule) {
  return (schedule || []).map((e) => ({
    token: e.token,
    unlockActKey: e.unlockActKey,
    unlockActIndex: e.unlockActIndex,
    clueKeys: e.clueKeys,
    aliases: e.aliases,
    personalEarly: e.personalEarly,
    grantMode: e.grantMode,
    source: e.source
  }));
}
