export const ROOM_EXPERIENCE_STATE_KINDS = Object.freeze({
  LOCATION_DISCOVERY: "location_discovery",
  PACE_CLOCK: "pace_clock",
  SESSION_CONCLUSION: "session_conclusion",
  RECAP_LIBRARY: "recap_library",
  ITEM_ACTION: "item_action",
  RELATIONSHIP_STATE: "relationship_state",
  INTERACTION: "interaction",
});

export const ROOM_EXPERIENCE_VISIBILITIES = Object.freeze([
  "host",
  "role",
  "room",
  "public",
]);

const KIND_VALUES = new Set(Object.values(ROOM_EXPERIENCE_STATE_KINDS));
const VISIBILITY_VALUES = new Set(ROOM_EXPERIENCE_VISIBILITIES);
const KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export class RoomExperienceStateError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RoomExperienceStateError";
    this.code = code;
    this.details = details;
  }
}

function reject(code, message, details) {
  throw new RoomExperienceStateError(code, message, details);
}

function object(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    reject("invalid_payload", `${field} must be an object`, { field });
  }
  return value;
}

function text(value, field, { required = true, max = 160 } = {}) {
  const normalized = String(value ?? "").trim();
  if (required && !normalized) {
    reject("invalid_identity", `${field} is required`, { field });
  }
  if (normalized.length > max) {
    reject("invalid_identity", `${field} is too long`, { field, max });
  }
  return normalized || null;
}

function oneOf(value, field, values, fallback = null) {
  const normalized = value == null || value === "" ? fallback : String(value);
  if (!values.includes(normalized)) {
    reject("invalid_payload", `${field} has an unsupported value`, {
      field,
      value: normalized,
      values,
    });
  }
  return normalized;
}

function integer(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < min || normalized > max) {
    reject("invalid_payload", `${field} must be an integer between ${min} and ${max}`, {
      field,
    });
  }
  return normalized;
}

function instant(value, field, { nullable = false } = {}) {
  if (nullable && (value == null || value === "")) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    reject("invalid_payload", `${field} must be an ISO timestamp`, { field });
  }
  return parsed.toISOString();
}

function stringList(value, field, { maxItems = 500 } = {}) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    reject("invalid_payload", `${field} must be an array with at most ${maxItems} items`, {
      field,
    });
  }
  return [...new Set(value.map((item) => text(item, field, { max: 160 })))];
}

function assertPayloadSize(payload) {
  const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  if (bytes > 64 * 1024) {
    reject("payload_too_large", "experience state payload exceeds 64 KiB", { bytes });
  }
}

function normalizeLocationDiscovery(payload, now) {
  const source = object(payload, "payload");
  const phase = oneOf(
    source.phase,
    "phase",
    ["idle", "scanning", "ready", "drawing", "complete"],
    "idle",
  );
  const drawnClueIds = stringList(source.drawnClueIds, "drawnClueIds");
  const drawn = new Set(drawnClueIds);
  const remainingClueIds = stringList(source.remainingClueIds, "remainingClueIds")
    .filter((clueId) => !drawn.has(clueId));
  const remainingCount = integer(source.remainingCount ?? 0, "remainingCount", {
    max: 10000,
  });
  if (remainingCount !== remainingClueIds.length) {
    reject("invalid_payload", "remainingCount must match remainingClueIds", {
      field: "remainingCount",
    });
  }
  return {
    locationId: text(source.locationId, "locationId"),
    segmentKey: text(source.segmentKey, "segmentKey"),
    phase,
    drawnClueIds,
    remainingClueIds,
    remainingCount,
    scanStartedAt: instant(source.scanStartedAt, "scanStartedAt", { nullable: true }),
    scanReadyAt: instant(source.scanReadyAt, "scanReadyAt", { nullable: true }),
    completedAt: instant(source.completedAt, "completedAt", { nullable: true }),
    updatedAt: instant(source.updatedAt ?? now, "updatedAt"),
  };
}

function normalizePaceClock(payload, now) {
  const source = object(payload, "payload");
  const mode = oneOf(source.mode, "mode", ["countdown", "countup"], "countdown");
  const status = oneOf(
    source.status,
    "status",
    ["idle", "running", "paused", "completed"],
    "idle",
  );
  const durationMs = integer(source.durationMs ?? 0, "durationMs", {
    max: 24 * 60 * 60 * 1000,
  });
  if (mode === "countdown" && durationMs < 1000) {
    reject("invalid_payload", "countdown durationMs must be at least 1000", {
      field: "durationMs",
    });
  }
  return {
    mode,
    status,
    label: text(source.label ?? "", "label", { required: false, max: 80 }) ?? "",
    durationMs,
    elapsedMs: integer(source.elapsedMs ?? 0, "elapsedMs", {
      max: 7 * 24 * 60 * 60 * 1000,
    }),
    startedAt: instant(source.startedAt, "startedAt", { nullable: true }),
    visibleToPlayers: Boolean(source.visibleToPlayers),
    updatedAt: instant(source.updatedAt ?? now, "updatedAt"),
  };
}

function normalizeSessionConclusion(payload, now) {
  const source = object(payload, "payload");
  const status = oneOf(
    source.status,
    "status",
    ["idle", "publishing", "recap_pending", "ready", "failed"],
    "idle",
  );
  const idempotencyKey = text(source.idempotencyKey, "idempotencyKey", {
    required: status !== "idle",
    max: 160,
  });
  return {
    status,
    endingId: text(source.endingId, "endingId", { required: false }),
    recapId: text(source.recapId, "recapId", { required: false }),
    idempotencyKey,
    failureCode: text(source.failureCode, "failureCode", { required: false, max: 80 }),
    updatedAt: instant(source.updatedAt ?? now, "updatedAt"),
  };
}

function normalizeRecapLibrary(payload) {
  const source = object(payload, "payload");
  return {
    hiddenRecapIds: stringList(source.hiddenRecapIds, "hiddenRecapIds", { maxItems: 100 }),
    retentionDays: integer(source.retentionDays ?? 0, "retentionDays", { max: 3650 }),
  };
}

function normalizeItemAction(payload, now) {
  const source = object(payload, "payload");
  const actionKind = oneOf(source.actionKind, "actionKind", ["use", "consume", "combine"]);
  const targetType = oneOf(source.targetType, "targetType", ["none", "role", "location"], "none");
  const status = oneOf(source.status, "status", ["pending", "approved", "rejected", "failed"]);
  return {
    actionId: text(source.actionId, "actionId"),
    itemId: text(source.itemId, "itemId"),
    actionKey: text(source.actionKey, "actionKey", { max: 64 }),
    actionKind,
    label: text(source.label, "label", { max: 120 }),
    roleSlotId: text(source.roleSlotId, "roleSlotId"),
    targetType,
    targetId: text(source.targetId, "targetId", { required: targetType !== "none" }),
    combineItemId: text(source.combineItemId, "combineItemId", { required: actionKind === "combine" }),
    consumeQuantity: integer(source.consumeQuantity ?? 0, "consumeQuantity", { max: 99 }),
    combineConsumeQuantity: integer(source.combineConsumeQuantity ?? 0, "combineConsumeQuantity", { max: 99 }),
    requiresHostConfirmation: Boolean(source.requiresHostConfirmation),
    status,
    resultText: text(source.resultText, "resultText", { required: false, max: 2000 }) ?? "",
    failureCode: text(source.failureCode, "failureCode", { required: false, max: 80 }),
    submittedAt: instant(source.submittedAt ?? now, "submittedAt"),
    resolvedAt: instant(source.resolvedAt, "resolvedAt", { nullable: true }),
  };
}

function normalizeRelationshipState(payload, now) {
  const source = object(payload, "payload");
  const historySource = Array.isArray(source.history) ? source.history.slice(-30) : [];
  return {
    relationshipId: text(source.relationshipId, "relationshipId"),
    fromRoleSlotId: text(source.fromRoleSlotId, "fromRoleSlotId"),
    toRoleSlotId: text(source.toRoleSlotId, "toRoleSlotId"),
    currentStrength: integer(source.currentStrength ?? 0, "currentStrength", { min: -10, max: 10 }),
    status: oneOf(source.status, "status", ["unknown", "allied", "trusted", "strained", "hostile", "broken"], "unknown"),
    disclosure: oneOf(source.disclosure, "disclosure", ["hidden", "involved", "public"], "hidden"),
    publicLabel: text(source.publicLabel, "publicLabel", { required: false, max: 200 }) ?? "",
    publicNote: text(source.publicNote, "publicNote", { required: false, max: 1000 }) ?? "",
    hostNote: text(source.hostNote, "hostNote", { required: false, max: 2000 }) ?? "",
    history: historySource.map((entry) => ({
      strength: integer(entry?.strength ?? 0, "history.strength", { min: -10, max: 10 }),
      status: oneOf(entry?.status, "history.status", ["unknown", "allied", "trusted", "strained", "hostile", "broken"], "unknown"),
      label: text(entry?.label, "history.label", { required: false, max: 200 }) ?? "",
      note: text(entry?.note, "history.note", { required: false, max: 1000 }) ?? "",
      changedAt: instant(entry?.changedAt ?? now, "history.changedAt"),
    })),
    updatedAt: instant(source.updatedAt ?? now, "updatedAt"),
  };
}

const NORMALIZERS = new Map([
  [ROOM_EXPERIENCE_STATE_KINDS.LOCATION_DISCOVERY, normalizeLocationDiscovery],
  [ROOM_EXPERIENCE_STATE_KINDS.PACE_CLOCK, normalizePaceClock],
  [ROOM_EXPERIENCE_STATE_KINDS.SESSION_CONCLUSION, normalizeSessionConclusion],
  [ROOM_EXPERIENCE_STATE_KINDS.RECAP_LIBRARY, normalizeRecapLibrary],
  [ROOM_EXPERIENCE_STATE_KINDS.ITEM_ACTION, normalizeItemAction],
  [ROOM_EXPERIENCE_STATE_KINDS.RELATIONSHIP_STATE, normalizeRelationshipState],
]);

export function normalizeRoomExperienceIdentity(input) {
  const stateKind = text(input?.stateKind, "stateKind", { max: 64 });
  if (!KEY_PATTERN.test(stateKind) || !KIND_VALUES.has(stateKind)) {
    reject("unsupported_state_kind", "stateKind has no registered contract", {
      stateKind,
    });
  }
  const visibility = String(input?.visibility ?? "host");
  if (!VISIBILITY_VALUES.has(visibility)) {
    reject("invalid_visibility", "visibility is unsupported", { visibility });
  }
  return {
    stateKind,
    scopeKey: text(input?.scopeKey, "scopeKey"),
    subjectKey: text(input?.subjectKey ?? "room", "subjectKey"),
    schemaVersion: integer(input?.schemaVersion ?? 1, "schemaVersion", { min: 1, max: 1000 }),
    visibility,
  };
}

export function normalizeRoomExperiencePayload(stateKind, payload, { now = new Date() } = {}) {
  const normalizer = NORMALIZERS.get(stateKind);
  const normalized = normalizer
    ? normalizer(payload, now)
    : { ...object(payload, "payload") };
  assertPayloadSize(normalized);
  return normalized;
}

export function registerRoomExperiencePayloadNormalizer(stateKind, normalizer) {
  if (!KIND_VALUES.has(stateKind) || typeof normalizer !== "function") {
    reject("invalid_normalizer", "normalizer requires a registered state kind");
  }
  NORMALIZERS.set(stateKind, normalizer);
}
