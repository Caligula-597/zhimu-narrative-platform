const VALID_AUDIENCES = new Set(["player", "host", "creator"]);
const VALID_SYNC_STATUS = new Set(["synced", "reconnecting", "stale", "offline"]);

export function normalizeRuntimeCurrentState(value, {
  audience,
  connected = true
} = {}) {
  const source = value && typeof value === "object" ? value : {};
  const expectedAudience = VALID_AUDIENCES.has(audience) ? audience : source.audience;
  const serverStatus = VALID_SYNC_STATUS.has(source.syncState?.status)
    ? source.syncState.status
    : "stale";
  const status = connected ? serverStatus : (source.syncState ? "reconnecting" : "offline");
  return {
    audience: VALID_AUDIENCES.has(source.audience) ? source.audience : expectedAudience,
    roomId: source.roomId ?? null,
    worldId: source.worldId ?? null,
    phase: source.phase ?? { key: "unknown", label: "状态待确认", detail: "" },
    suggestedActions: Array.isArray(source.suggestedActions) ? source.suggestedActions : [],
    blockers: Array.isArray(source.blockers) ? source.blockers : [],
    mechanism: source.mechanism && typeof source.mechanism === "object"
      ? source.mechanism
      : null,
    syncState: {
      status,
      runtimeSource: source.syncState?.runtimeSource ?? "live_draft",
      isFrozen: Boolean(source.syncState?.isFrozen),
      serverCursor: Number(source.syncState?.serverCursor) || 0,
      generatedAt: source.syncState?.generatedAt ?? null
    },
    metrics: source.metrics && typeof source.metrics === "object" ? source.metrics : {}
  };
}

export function primaryRuntimeAction(value) {
  return normalizeRuntimeCurrentState(value).suggestedActions
    .slice()
    .sort((left, right) => Number(left.priority) - Number(right.priority))[0] ?? null;
}
