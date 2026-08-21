import { projectRoomContentBinding } from "./room-content-binding.js";
import { normalizeLocationDiscoveryCopy } from "./location-discovery.js";

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

function pickObject(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(keys
    .filter((key) => Object.hasOwn(value, key))
    .map((key) => [key, value[key]]));
}

const PUBLIC_DICE_KEYS = ["count", "sides", "modifier", "defaultTarget"];
const PUBLIC_CHECK_RESULT_KEYS = [
  "label", "rollMode", "rawTotal", "total", "target", "success",
  "criticalSuccess", "criticalFailure", "margin", "degree", "degreeLabel", "degreeRank"
];

function normalizePlayerDice(value) {
  return pickObject(value, PUBLIC_DICE_KEYS) || {};
}

function normalizePlayerCheckResult(value) {
  const result = pickObject(value, PUBLIC_CHECK_RESULT_KEYS);
  if (!result) return null;
  result.attempts = (Array.isArray(value.attempts) ? value.attempts : [])
    .slice(0, 2)
    .map((attempt) => Array.isArray(attempt) ? attempt.slice(0, 10) : []);
  result.rolls = Array.isArray(value.rolls) ? value.rolls.slice(0, 10) : [];
  return result;
}

function normalizePlayerCheck(value) {
  const check = pickObject(value, [
    "id", "templateId", "locationId", "label", "instruction", "target", "bonus",
    "rollMode", "dice", "status", "result", "outcomeText", "startedAt", "resolvedAt",
    "appliedChanges", "appliedAt"
  ]);
  if (!check) return null;
  check.dice = normalizePlayerDice(value.dice);
  check.result = normalizePlayerCheckResult(value.result);
  check.appliedChanges = (Array.isArray(value.appliedChanges) ? value.appliedChanges : [])
    .slice(0, 8)
    .map((change) => pickObject(change, ["id", "label", "delta"]))
    .filter(Boolean);
  return check;
}

function normalizePlayerEncounter(value) {
  const encounter = pickObject(value, ["locationId", "locationName", "status", "startedAt"]);
  if (!encounter) return null;
  encounter.npcs = (Array.isArray(value.npcs) ? value.npcs : [])
    .slice(0, 24)
    .map((npc) => pickObject(npc, ["id", "name", "role", "hp", "maxHp"]))
    .filter(Boolean);
  return encounter;
}

function normalizePlayerMap(value) {
  const map = pickObject(value, [
    "title", "visible", "activeLocationId", "revealedLocationIds", "routes", "dice", "publishedEnding"
  ]) || {};
  map.revealedLocationIds = Array.isArray(value.revealedLocationIds)
    ? value.revealedLocationIds.slice(0, 24)
      .map((id) => typeof id === "string" || typeof id === "number" ? String(id) : "")
      .filter(Boolean)
    : [];
  const normalizePlayerLocation = (location) => {
    const projected = pickObject(location, [
      "id", "name", "type", "description", "segmentKey", "x", "y", "z"
    ]);
    if (!projected) return null;
    projected.discovery = normalizeLocationDiscoveryCopy(location?.discovery);
    return projected;
  };
  map.activeLocation = normalizePlayerLocation(value.activeLocation);
  map.locations = (Array.isArray(value.locations) ? value.locations : [])
    .slice(0, 24)
    .map(normalizePlayerLocation)
    .filter(Boolean);
  const publicLocationIds = new Set(map.locations.map((location) => location.id).filter(Boolean));
  map.routes = (Array.isArray(value.routes) ? value.routes : [])
    .slice(0, 64)
    .map((route) => Array.isArray(route) ? route.slice(0, 2).map(String) : [])
    .filter(([from, to]) => from && to && from !== to && publicLocationIds.has(from) && publicLocationIds.has(to));
  map.party = (Array.isArray(value.party) ? value.party : [])
    .slice(0, 12)
    .map((member) => pickObject(member, ["id", "name", "role", "hp", "maxHp"]))
    .filter(Boolean);
  map.dice = normalizePlayerDice(value.dice);
  map.activeCheck = normalizePlayerCheck(value.activeCheck);
  map.activeEncounter = normalizePlayerEncounter(value.activeEncounter);
  map.publishedEnding = pickObject(value.publishedEnding, ["id", "name", "summary", "tone", "publishedAt"]);
  map.host = null;
  return map;
}

function normalizePresentation(value, audience) {
  const source = value && typeof value === "object" ? value : {};
  const map = source.map && typeof source.map === "object" ? source.map : null;
  return {
    activeSegmentKey: String(source.activeSegmentKey ?? ""),
    updatedAt: source.updatedAt ?? null,
    map: map
      ? audience === "player"
        ? normalizePlayerMap(map)
        : {
            ...map,
            activeCheck: map.activeCheck && typeof map.activeCheck === "object" ? { ...map.activeCheck } : null,
            activeEncounter: map.activeEncounter && typeof map.activeEncounter === "object"
              ? {
                  ...map.activeEncounter,
                  npcs: Array.isArray(map.activeEncounter.npcs)
                    ? map.activeEncounter.npcs.map((npc) => ({ ...npc }))
                    : []
                }
              : null,
            host: map.host ?? null
          }
      : null
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
