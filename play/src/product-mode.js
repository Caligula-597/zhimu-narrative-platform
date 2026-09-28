export const PLAYER_PRODUCT_MODE_KEY = "zhimuPlayProductMode";

export const PLAYER_PRODUCT_MODES = Object.freeze([
  {
    id: "murder_mystery",
    label: "剧本杀",
    title: "角色剧情与线索",
    description: "阅读分幕、探索场景、管理线索，专注于角色推理。",
    available: true,
    accent: "plum"
  },
  {
    id: "tabletop_rpg",
    label: "跑团",
    title: "暂未开放",
    description: "",
    available: false,
    accent: "blue"
  },
  {
    id: "board_game",
    label: "桌游",
    title: "牌桌、资源与回合",
    description: "查看公共桌面、手牌、资源、回合和卡牌响应。",
    available: true,
    accent: "brass"
  }
]);

const VALID_PRODUCT_MODES = new Set(PLAYER_PRODUCT_MODES.map((mode) => mode.id));

export function normalizeProductMode(value) {
  return VALID_PRODUCT_MODES.has(value) ? value : "";
}

export function productModeForRoom(room) {
  return normalizeProductMode(
    room?.creationType
    || room?.creation_type
    || room?.room?.creationType
    || room?.room?.creation_type
  );
}

export function productModeMeta(mode) {
  return PLAYER_PRODUCT_MODES.find((item) => item.id === normalizeProductMode(mode)) || PLAYER_PRODUCT_MODES[0];
}

export function readStoredProductMode() {
  try {
    return normalizeProductMode(localStorage.getItem(PLAYER_PRODUCT_MODE_KEY));
  } catch {
    return "";
  }
}

export function persistProductMode(mode) {
  const normalized = normalizeProductMode(mode);
  if (!normalized) return "";
  try {
    localStorage.setItem(PLAYER_PRODUCT_MODE_KEY, normalized);
  } catch {
    // A private browsing context may reject storage; in-memory state still works.
  }
  return normalized;
}

export function productModeMatchesRoom(mode, room) {
  const roomMode = productModeForRoom(room);
  return !roomMode || roomMode === normalizeProductMode(mode);
}
