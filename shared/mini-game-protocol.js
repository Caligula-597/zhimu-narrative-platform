export const MINI_GAME_PROTOCOL_VERSION = 1;
export const MINI_GAME_PLUGIN_KEYS = Object.freeze(["zhimu_lock"]);

function text(value, fallback, max) {
  return String(value ?? "").trim().slice(0, max) || fallback;
}

function integer(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

export function normalizeMiniGameTemplate(raw = {}) {
  const answer = text(raw.answer, "", 32);
  const requestedPlugin = raw.pluginKey || raw.gameType;
  const pluginKey = MINI_GAME_PLUGIN_KEYS.includes(requestedPlugin)
    ? requestedPlugin
    : "zhimu_lock";
  return {
    id: text(raw.id, `lock-${Date.now()}`, 80),
    protocolVersion: MINI_GAME_PROTOCOL_VERSION,
    pluginKey,
    gameType: pluginKey,
    title: text(raw.title, "数字密码锁", 120),
    prompt: text(raw.prompt, "输入线索中得到的密码。", 500),
    hint: text(raw.hint, "", 500),
    answer,
    length: integer(raw.length, answer.length || 4, 1, 12),
    maxAttempts: integer(raw.maxAttempts ?? raw.max_attempts, 3, 1, 12),
    timeoutSeconds: integer(raw.timeoutSeconds ?? raw.timeout_seconds, 0, 0, 86_400),
    allowRecovery: raw.allowRecovery ?? raw.allow_recovery ?? true,
    successText: text(raw.successText ?? raw.success_text, "机关已解开，可以继续推进。", 1000),
    failureText: text(raw.failureText ?? raw.failure_text, "机关暂时锁死，请等待主持人处理。", 1000),
    recapLabel: text(raw.recapLabel ?? raw.recap_label, raw.title || "数字密码锁", 160),
  };
}

export function normalizeMiniGameTemplates(input) {
  return (Array.isArray(input) ? input : []).slice(0, 50).map(normalizeMiniGameTemplate);
}
