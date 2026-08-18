/** V6 world-engine vocabulary. Facts are typed IDs, never prose. */

export const WORLD_ENGINE_VERSION = 6;

export const VENUE_KEYS = Object.freeze([
  "photo_studio",
  "bus_station",
  "tv_station",
  "hotel"
]);

export const VENUE_LABELS = Object.freeze({
  photo_studio: "婚纱影楼",
  bus_station: "汽车站",
  tv_station: "电视台",
  hotel: "酒店"
});

export const ERA_KEYS = Object.freeze([
  "contemporary",
  "2000s",
  "1990s",
  "republican",
  "ancient",
  "near_future"
]);

export const GENRE_KEYS = Object.freeze([
  "mystery",
  "comedy",
  "emotion",
  "social",
  "faction",
  "crime",
  "dark_humor",
  "melodrama",
  "family",
  "romance",
  "profession",
  "horror",
  "supernatural",
  "mechanism",
  "ensemble"
]);

export const ALLOWED_CONTENT_KEYS = Object.freeze([
  "murder",
  "accident_death",
  "missing",
  "affair",
  "illegitimate_child",
  "scapegoat",
  "perjury",
  "blackmail",
  "theft",
  "debt",
  "inheritance",
  "workplace_accident",
  "power_struggle",
  "romance",
  "identity",
  "mentor_grudge",
  "kin_conflict"
]);

export const ACTION_TYPES = Object.freeze([
  "move",
  "enter",
  "give",
  "take",
  "hide",
  "borrow",
  "repay",
  "spend",
  "create_object",
  "approve",
  "deny",
  "delay",
  "assign",
  "search",
  "assert",
  "medical_procedure",
  "employ",
  "resign"
]);

export const OPERATIONAL_ACTIONS = Object.freeze([
  "enter",
  "hold",
  "give",
  "hide",
  "show",
  "verify",
  "approve",
  "deny",
  "delay",
  "spend",
  "trade",
  "search",
  "assign"
]);

export const DISTORTION_TYPES = Object.freeze([
  "omission",
  "source_confusion",
  "post_event_contamination"
]);

export const WEAK_ACTIONS = Object.freeze(["tell", "ask", "read", "vote"]);

export function padId(prefix, n) {
  return `${prefix}_${String(n).padStart(3, "0")}`;
}

export function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function list(value) {
  return Array.isArray(value) ? value : [];
}

export function text(value, max = 400) {
  return String(value ?? "").trim().slice(0, max);
}

export function intInRange(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

export function characterById(state, id) {
  return list(state.characters).find((row) => row.id === id) || null;
}

export function objectById(state, id) {
  return list(state.objects).find((row) => row.id === id) || null;
}

export function locationById(state, id) {
  return list(state.schema?.locations).find((row) => row.id === id) || null;
}

export function roleByKey(state, key) {
  return list(state.schema?.roles).find((row) => row.key === key) || null;
}

export function objectTypeByKey(state, key) {
  return record(state.schema?.objectTypes)[key] || null;
}

export function formatAction(action = {}, state = {}) {
  const type = String(action.type || "");
  const actor = characterById(state, action.actor)?.name || action.actor || "";
  if (type === "borrow") {
    const other = characterById(state, action.counterparty)?.name || action.counterparty;
    return `${actor}向${other}借${action.amount ?? ""}`;
  }
  if (type === "repay") {
    const other = characterById(state, action.counterparty)?.name || action.counterparty;
    return `${actor}向${other}还${action.amount ?? ""}`;
  }
  if (type === "give") {
    const object = objectById(state, action.objectId)?.id || action.objectId;
    const other = characterById(state, action.to)?.name || action.to;
    return `${actor}把${object}交给${other}`;
  }
  if (type === "move" || type === "enter") {
    const loc = locationById(state, action.locationId)?.name || action.locationId;
    return `${actor}进入${loc}`;
  }
  if (type === "assert") {
    return `${actor}说了一句话`;
  }
  if (type === "hide") {
    return `${actor}藏起${action.objectId || "物件"}`;
  }
  if (type === "medical_procedure") {
    const patient = characterById(state, action.patient)?.name || action.patient;
    return `${patient}产生医疗支出${action.cost ?? ""}`;
  }
  return actor ? `${actor}：${type}` : type;
}
