export const ROOM_STATUS = {
  active: { label: "运行中", tone: "published" },
  ready: { label: "已建立", tone: "testing" },
  empty: { label: "未建立", tone: "draft" },
  polling: { label: "轮询中", tone: "testing" },
  connected: { label: "实时连接", tone: "published" }
};

export const PLAYER_STATUS = {
  joined: { label: "已加入", tone: "published" },
  waiting: { label: "等待中", tone: "testing" },
  stuck: { label: "疑似卡关", tone: "testing" },
  offline: { label: "未加入", tone: "draft" },
  complete: { label: "已完成", tone: "published" }
};

export const CLUE_STATUS = {
  public: { label: "公开", tone: "published" },
  private: { label: "私密", tone: "draft" },
  shared: { label: "已分享", tone: "testing" },
  unread: { label: "未读", tone: "draft" },
  read: { label: "已读", tone: "testing" },
  key: { label: "关键线索", tone: "published" },
  incomplete: { label: "待补全", tone: "draft" }
};

const TABLES = {
  room: ROOM_STATUS,
  player: PLAYER_STATUS,
  clue: CLUE_STATUS
};

export function runtimeStatus(kind, value, fallback = {}) {
  const key = String(value ?? "").trim().toLowerCase();
  const found = TABLES[kind]?.[key];
  if (found) return { key, ...found };
  return {
    key: key || "unknown",
    label: fallback.label || key || "未知",
    tone: fallback.tone || "draft"
  };
}

export function roomStatusFromRuntime({ hasActiveRoom = false, hasRooms = false, connected = false } = {}) {
  if (connected) return runtimeStatus("room", "connected");
  if (hasActiveRoom) return runtimeStatus("room", "active");
  if (hasRooms) return runtimeStatus("room", "ready");
  return runtimeStatus("room", "empty");
}

export function playerStatusFromRuntime({ joined = false, waiting = false, stuck = false, complete = false } = {}) {
  if (stuck) return runtimeStatus("player", "stuck");
  if (waiting) return runtimeStatus("player", "waiting");
  if (complete) return runtimeStatus("player", "complete");
  if (joined) return runtimeStatus("player", "joined");
  return runtimeStatus("player", "offline");
}

export function clueStatusFromRuntime({ visibility = "", read = false, shared = false, key = false, incomplete = false } = {}) {
  if (incomplete) return runtimeStatus("clue", "incomplete");
  if (key) return runtimeStatus("clue", "key");
  if (shared) return runtimeStatus("clue", "shared");
  if (read) return runtimeStatus("clue", "read");
  if (visibility === "public") return runtimeStatus("clue", "public");
  return runtimeStatus("clue", "private");
}
