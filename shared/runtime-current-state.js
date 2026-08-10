import { projectRoomContentBinding } from "./room-content-binding.js";

const VALID_AUDIENCES = new Set(["player", "host", "creator"]);
const VALID_SYNC_STATUS = new Set(["synced", "reconnecting", "stale", "offline"]);
const VALID_BEAT_SOURCES = new Set([
  "mechanism_round",
  "reading_progress",
  "next_section",
  "host_control",
  "segment_order",
  "none"
]);

function normalizePresentation(value, audience) {
  const source = value && typeof value === "object" ? value : {};
  const map = source.map && typeof source.map === "object" ? source.map : null;
  return {
    activeSegmentKey: String(source.activeSegmentKey ?? ""),
    updatedAt: source.updatedAt ?? null,
    map: map ? {
      ...map,
      activeCheck: map.activeCheck && typeof map.activeCheck === "object" ? { ...map.activeCheck } : null,
      host: audience === "player" ? null : map.host ?? null
    } : null
  };
}

function textList(value) {
  return Array.isArray(value) ? value.map((item) => String(item ?? "")).filter(Boolean) : [];
}

function normalizeCurrentBeat(value, audience) {
  if (!value || typeof value !== "object") return null;
  const player = value.player && typeof value.player === "object" ? value.player : {};
  const host = value.host && typeof value.host === "object" ? value.host : null;
  return {
    id: value.id ?? null,
    key: String(value.key ?? ""),
    title: String(value.title ?? ""),
    sequence: Math.max(1, Number(value.sequence) || 1),
    position: Math.max(1, Number(value.position) || 1),
    total: Math.max(1, Number(value.total) || 1),
    source: VALID_BEAT_SOURCES.has(value.source) ? value.source : "segment_order",
    player: {
      content: String(player.content ?? ""),
      tips: textList(player.tips),
      tasks: textList(player.tasks)
    },
    host: audience === "player" || !host
      ? null
      : {
          goal: String(host.goal ?? ""),
          flow: String(host.flow ?? ""),
          hostTruth: String(host.hostTruth ?? ""),
          dmTasks: String(host.dmTasks ?? ""),
          openClues: String(host.openClues ?? ""),
          privateChatHints: String(host.privateChatHints ?? ""),
          advanceCondition: String(host.advanceCondition ?? ""),
          fallbacks: textList(host.fallbacks),
          estimatedMinutes: host.estimatedMinutes == null
            ? null
            : Math.max(0, Number(host.estimatedMinutes) || 0)
        }
  };
}

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
    contentBinding: source.contentBinding && typeof source.contentBinding === "object"
      ? projectRoomContentBinding(source.contentBinding, {
          runtimeSource: source.syncState?.runtimeSource
        })
      : null,
    currentBeat: normalizeCurrentBeat(source.currentBeat, expectedAudience),
    presentation: normalizePresentation(source.presentation, expectedAudience),
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
