export const MINI_GAME_PROTOCOL_VERSION = 1;
export const MINI_GAME_PLUGIN_KEYS = Object.freeze([
  "zhimu_lock",
  "zhimu_sequence",
  "zhimu_guess",
]);

function text(value, fallback, max) {
  return String(value ?? "").trim().slice(0, max) || fallback;
}

function integer(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function normalizeSequenceAnswer(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/[，、；;|/]+/g, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join(",");
}

function normalizeGuessAnswer(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .slice(0, 64);
}

function pluginDefaults(pluginKey) {
  if (pluginKey === "zhimu_sequence") {
    return {
      idPrefix: "sequence",
      title: "顺序还原",
      prompt: "按正确顺序输入关键步骤（用逗号分隔）。",
    };
  }
  if (pluginKey === "zhimu_guess") {
    return {
      idPrefix: "guess",
      title: "歌猜 / 口令",
      prompt: "根据提示提交你的猜测（可忽略空格与大小写差异由主持端约定）。",
    };
  }
  return {
    idPrefix: "lock",
    title: "数字密码锁",
    prompt: "输入线索中得到的密码。",
  };
}

export function normalizeMiniGameTemplate(raw = {}) {
  const requestedPlugin = raw.pluginKey || raw.gameType;
  const pluginKey = MINI_GAME_PLUGIN_KEYS.includes(requestedPlugin)
    ? requestedPlugin
    : "zhimu_lock";
  const defaults = pluginDefaults(pluginKey);
  const isSequence = pluginKey === "zhimu_sequence";
  const isGuess = pluginKey === "zhimu_guess";
  const answer = isSequence
    ? normalizeSequenceAnswer(raw.answer)
    : isGuess
      ? normalizeGuessAnswer(raw.answer)
      : text(raw.answer, "", 32);
  const sequenceLength = answer ? answer.split(",").filter(Boolean).length : 0;
  return {
    id: text(raw.id, `${defaults.idPrefix}-${Date.now()}`, 80),
    protocolVersion: MINI_GAME_PROTOCOL_VERSION,
    pluginKey,
    gameType: pluginKey,
    title: text(raw.title, defaults.title, 120),
    prompt: text(raw.prompt, defaults.prompt, 500),
    hint: text(raw.hint, "", 500),
    answer,
    length: integer(
      raw.length,
      isSequence ? sequenceLength || 3 : isGuess ? Math.max(1, answer.length || 4) : answer.length || 4,
      1,
      12
    ),
    maxAttempts: integer(raw.maxAttempts ?? raw.max_attempts, 3, 1, 12),
    timeoutSeconds: integer(raw.timeoutSeconds ?? raw.timeout_seconds, 0, 0, 86_400),
    allowRecovery: raw.allowRecovery ?? raw.allow_recovery ?? true,
    successText: text(
      raw.successText ?? raw.success_text,
      "机关已解开，可以继续推进。",
      1000
    ),
    failureText: text(
      raw.failureText ?? raw.failure_text,
      "机关暂时锁死，请等待主持人处理。",
      1000
    ),
    recapLabel: text(
      raw.recapLabel ?? raw.recap_label,
      raw.title || defaults.title,
      160
    ),
  };
}

export function normalizeMiniGameTemplates(input) {
  return (Array.isArray(input) ? input : []).slice(0, 50).map(normalizeMiniGameTemplate);
}
