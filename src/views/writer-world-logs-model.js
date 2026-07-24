export const WORLD_LOG_PAGE_SIZE = 50;
export const WORLD_LOG_MAX_LIMIT = 200;

export const WORLD_LOG_EVENT_OPTIONS = Object.freeze([
  ["", "全部事件"],
  ["reading_completed", "阅读完成"],
  ["investigation_completed", "调查完成"],
  ["clue_read", "线索阅读"],
  ["clue_shared_room", "线索公开"],
  ["host_grant_clue", "主持发线索"],
  ["host_grant_item", "主持发物品"],
  ["host_unlock_section", "解锁分幕"],
  ["scene_unlocked", "开放场景"],
  ["host_event_executed", "主持确认"],
  ["host_event_dismissed", "主持拒绝"],
  ["host_note", "主持备注"],
  ["rule_action", "规则动作"],
  ["player_kicked", "玩家被移出"]
]);

const WORLD_LOG_ROLES = new Set(["owner", "editor", "host"]);
const WORLD_LOG_EVENT_TYPES = new Set(WORLD_LOG_EVENT_OPTIONS.map(([value]) => value));

export function canReadWorldLogs(world) {
  return WORLD_LOG_ROLES.has(String(world?.membership_role || ""));
}

export function normalizeWorldLogFilters(data, filters = {}) {
  const roomIds = new Set((data?.rooms || []).map((room) => String(room.id || "")).filter(Boolean));
  const roomId = String(filters.roomId || "");
  const eventType = String(filters.eventType || "");
  const keyword = String(filters.keyword || "").trim().slice(0, 120);
  const rawLimit = Number(filters.limit);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(WORLD_LOG_PAGE_SIZE, Math.min(WORLD_LOG_MAX_LIMIT, Math.floor(rawLimit)))
    : WORLD_LOG_PAGE_SIZE;
  return {
    roomId: roomIds.has(roomId) ? roomId : "",
    eventType: WORLD_LOG_EVENT_TYPES.has(eventType) ? eventType : "",
    keyword,
    limit
  };
}

export function worldLogQuery(data, filters = {}) {
  const normalized = normalizeWorldLogFilters(data, filters);
  const query = { limit: String(normalized.limit) };
  if (normalized.roomId) query.roomId = normalized.roomId;
  if (normalized.eventType) query.eventType = normalized.eventType;
  if (normalized.keyword) query.keyword = normalized.keyword;
  return query;
}

export function worldLogStats(logs = [], limit = WORLD_LOG_PAGE_SIZE) {
  const rows = Array.isArray(logs) ? logs : [];
  return {
    returned: rows.length,
    rooms: new Set(rows.map((row) => String(row?.room_id || "")).filter(Boolean)).size,
    actors: new Set(rows.map((row) => String(row?.actor_name || "")).filter(Boolean)).size,
    hasMore: rows.length >= limit && limit < WORLD_LOG_MAX_LIMIT,
    capped: rows.length >= WORLD_LOG_MAX_LIMIT && limit >= WORLD_LOG_MAX_LIMIT
  };
}

export function worldLogVisibilityLabel(visibility = "") {
  const labels = {
    author: "仅作者",
    host: "主持可见",
    role: "角色私有",
    faction: "阵营可见",
    public: "全房公开",
    postgame: "复盘可见"
  };
  return labels[visibility] || visibility || "未标注";
}
