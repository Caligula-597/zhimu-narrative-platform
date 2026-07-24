export const HOST_EVENT_DELAY_LIMITS = Object.freeze({
  MIN: 1,
  MAX: 1440,
  DEFAULT: 15
});

const HOST_EVENT_COMMANDS = new Set(["execute", "dismiss", "delay"]);

function requestId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function eventSnapshot(event = {}) {
  return {
    id: String(event.id || ""),
    title: String(event.title || "待确认事件"),
    description: String(event.description || ""),
    status: String(event.status || "pending"),
    createdAt: event.created_at || "",
    delayUntil: event.delay_until || "",
    sourceLabel: String(event.source_label || "系统"),
    ruleName: String(event.rule_name || ""),
    ruleMode: String(event.rule_mode || ""),
    ruleConditions: event.rule_conditions && typeof event.rule_conditions === "object"
      ? event.rule_conditions
      : {},
    actions: Array.isArray(event.actions) ? event.actions : [],
    actionSummaries: Array.isArray(event.action_summaries) ? event.action_summaries.map(String) : [],
    triggerPlayers: Array.isArray(event.trigger_players) ? event.trigger_players.map(String) : []
  };
}

export function createHostEventWorkspace({ roomId, event, intent = "review" }) {
  return {
    id: requestId("host-event-workspace"),
    roomId: String(roomId || ""),
    eventId: String(event?.id || ""),
    event: eventSnapshot(event),
    intent: HOST_EVENT_COMMANDS.has(intent) ? intent : "review",
    delayMinutes: HOST_EVENT_DELAY_LIMITS.DEFAULT,
    requestKeys: {},
    requestFingerprints: {},
    status: "ready",
    message: "",
    errors: []
  };
}

export function updateHostEventDelay(workspace, value) {
  if (!workspace || hostEventWorkspaceIsLocked(workspace)) return workspace;
  workspace.delayMinutes = String(value ?? "");
  workspace.status = "ready";
  workspace.message = "";
  workspace.errors = [];
  return workspace;
}

export function parseHostEventCommand(workspace, command) {
  const errors = [];
  if (!HOST_EVENT_COMMANDS.has(command)) {
    errors.push({ path: "command", message: "事件操作无效" });
  }
  const payload = command === "delay"
    ? { delayMinutes: Number(workspace?.delayMinutes) }
    : {};
  if (command === "delay" && (!Number.isInteger(payload.delayMinutes)
    || payload.delayMinutes < HOST_EVENT_DELAY_LIMITS.MIN
    || payload.delayMinutes > HOST_EVENT_DELAY_LIMITS.MAX)) {
    errors.push({
      path: "delayMinutes",
      message: `延迟时长必须为 ${HOST_EVENT_DELAY_LIMITS.MIN}–${HOST_EVENT_DELAY_LIMITS.MAX} 分钟的整数`
    });
  }
  const fingerprint = JSON.stringify({ command, payload });
  return errors.length
    ? { ok: false, errors, fingerprint }
    : { ok: true, errors: [], command, payload, fingerprint };
}

export function hostEventRequestKey(workspace, command, fingerprint) {
  if (!workspace.requestKeys[command] || workspace.requestFingerprints[command] !== fingerprint) {
    workspace.requestKeys[command] = requestId(`host-event-${command}`);
    workspace.requestFingerprints[command] = fingerprint;
  }
  return workspace.requestKeys[command];
}

export function hostEventWorkspaceIsPending(workspace) {
  return workspace?.status === "submitting" || workspace?.status === "reconciling";
}

export function hostEventWorkspaceIsLocked(workspace) {
  return hostEventWorkspaceIsPending(workspace) || workspace?.status === "uncertain";
}

export function hostEventWorkspaceContextIsCurrent(workspace, roomId) {
  return Boolean(workspace?.roomId && String(workspace.roomId) === String(roomId || ""));
}

export function hostEventStillAvailable(workspace, events = []) {
  return events.some((event) => String(event.id) === String(workspace?.eventId));
}
