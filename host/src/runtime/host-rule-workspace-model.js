export const HOST_RULE_LIMITS = Object.freeze({
  NAME: 120,
  JSON_TEXT: 65_536,
  ACTIONS: 50,
  PRIORITY_MIN: 0,
  PRIORITY_MAX: 9999
});

export const HOST_RULE_MODES = Object.freeze([
  { id: "automatic", name: "自动执行" },
  { id: "host_confirm", name: "主持确认" },
  { id: "manual", name: "仅手动触发" }
]);

const DEFAULT_CONDITIONS = {
  all: [{ type: "reading_completed", roleSlotId: "", scriptSectionId: "" }]
};
const DEFAULT_ACTIONS = [{ type: "timeline_log", message: "主持端新建规则" }];

function requestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `host-rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function jsonText(value, fallback) {
  return JSON.stringify(value ?? fallback, null, 2);
}

function draftFromRule(rule = {}) {
  return {
    roomId: String(rule.room_id || rule.roomId || ""),
    name: String(rule.name || ""),
    mode: String(rule.mode || "automatic"),
    priority: String(rule.priority ?? 100),
    enabled: rule.enabled !== false,
    conditionsText: jsonText(rule.conditions, DEFAULT_CONDITIONS),
    actionsText: jsonText(rule.actions, DEFAULT_ACTIONS)
  };
}

export function hostRuleDraftFingerprint(draft = {}) {
  return JSON.stringify({
    roomId: String(draft.roomId || ""),
    name: String(draft.name || ""),
    mode: String(draft.mode || ""),
    priority: String(draft.priority || ""),
    enabled: Boolean(draft.enabled),
    conditionsText: String(draft.conditionsText || ""),
    actionsText: String(draft.actionsText || "")
  });
}

export function createHostRuleWorkspace({ worldId, rule = null }) {
  const draft = draftFromRule(rule || {});
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    worldId: String(worldId || ""),
    ruleId: String(rule?.id || ""),
    requestId: requestId(),
    originalMetadata: rule?.metadata && typeof rule.metadata === "object" ? { ...rule.metadata } : {},
    draft,
    baselineFingerprint: hostRuleDraftFingerprint(draft),
    validatedFingerprint: "",
    dirty: false,
    status: "ready",
    message: "",
    errors: [],
    confirm: null
  };
}

function error(path, message) {
  return { path, message };
}

function parseJson(text, path, label, errors) {
  if (String(text || "").length > HOST_RULE_LIMITS.JSON_TEXT) {
    errors.push(error(path, `${label}最多 ${HOST_RULE_LIMITS.JSON_TEXT} 个字符`));
    return null;
  }
  try {
    return JSON.parse(String(text || ""));
  } catch (parseError) {
    errors.push(error(path, `${label} JSON 格式错误：${parseError.message}`));
    return null;
  }
}

export function parseHostRuleDraft(workspace, { roomIds = [] } = {}) {
  const draft = workspace?.draft || {};
  const errors = [];
  const name = String(draft.name || "").trim();
  if (!name) errors.push(error("name", "请填写规则名称"));
  else if (name.length > HOST_RULE_LIMITS.NAME) {
    errors.push(error("name", `规则名称最多 ${HOST_RULE_LIMITS.NAME} 字`));
  }

  const mode = String(draft.mode || "");
  if (!HOST_RULE_MODES.some((item) => item.id === mode)) {
    errors.push(error("mode", "请选择有效触发模式"));
  }

  const priority = Number(draft.priority);
  if (!Number.isInteger(priority)
    || priority < HOST_RULE_LIMITS.PRIORITY_MIN
    || priority > HOST_RULE_LIMITS.PRIORITY_MAX) {
    errors.push(error(
      "priority",
      `优先级必须是 ${HOST_RULE_LIMITS.PRIORITY_MIN}–${HOST_RULE_LIMITS.PRIORITY_MAX} 的整数`
    ));
  }

  const roomId = String(draft.roomId || "");
  const knownRooms = new Set(roomIds.map(String));
  if (roomId && !knownRooms.has(roomId)) {
    errors.push(error("roomId", "绑定房间已不存在，请重新选择"));
  }

  const conditions = parseJson(draft.conditionsText, "conditions", "检测条件", errors);
  if (conditions != null && (!conditions || typeof conditions !== "object" || Array.isArray(conditions))) {
    errors.push(error("conditions", "检测条件必须是 JSON 对象"));
  }

  const actions = parseJson(draft.actionsText, "actions", "执行动作", errors);
  if (actions != null && !Array.isArray(actions)) {
    errors.push(error("actions", "执行动作必须是 JSON 数组"));
  } else if (Array.isArray(actions)) {
    if (!actions.length) errors.push(error("actions", "至少需要一个执行动作"));
    if (actions.length > HOST_RULE_LIMITS.ACTIONS) {
      errors.push(error("actions", `单条规则最多 ${HOST_RULE_LIMITS.ACTIONS} 个动作`));
    }
    actions.forEach((action, index) => {
      if (!action || typeof action !== "object" || Array.isArray(action) || !String(action.type || "").trim()) {
        errors.push(error(`actions.${index}`, `第 ${index + 1} 个动作缺少 type`));
      }
    });
  }

  if (errors.length) return { ok: false, errors };
  const metadata = {
    ...(workspace.originalMetadata || {}),
    hostRequestId: workspace.requestId
  };
  return {
    ok: true,
    errors: [],
    payload: {
      roomId: roomId || null,
      name,
      mode,
      priority,
      enabled: Boolean(draft.enabled),
      conditions,
      actions,
      metadata
    },
    fingerprint: hostRuleDraftFingerprint(draft)
  };
}

export function updateHostRuleWorkspaceField(workspace, field, value, checked) {
  if (!workspace?.draft
    || !field
    || workspace.status === "submitting"
    || workspace.status === "validating"
    || workspace.status === "uncertain") {
    return workspace;
  }
  workspace.draft[field] = field === "enabled" ? Boolean(checked) : String(value ?? "");
  const fingerprint = hostRuleDraftFingerprint(workspace.draft);
  workspace.dirty = fingerprint !== workspace.baselineFingerprint;
  if (workspace.validatedFingerprint !== fingerprint) workspace.validatedFingerprint = "";
  workspace.status = "ready";
  workspace.message = "";
  workspace.errors = [];
  workspace.confirm = null;
  return workspace;
}

export function hostRuleWorkspaceIsPending(workspace) {
  return workspace?.status === "validating" || workspace?.status === "submitting";
}

export function hostRuleWorkspaceContextIsCurrent(workspace, worldId) {
  return Boolean(workspace?.worldId && String(workspace.worldId) === String(worldId || ""));
}

export function hostRuleModeLabel(mode) {
  return HOST_RULE_MODES.find((item) => item.id === mode)?.name || mode || "自动执行";
}
