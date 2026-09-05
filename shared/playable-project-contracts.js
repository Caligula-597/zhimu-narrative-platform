/**
 * P7.0 PlayableProject contracts — Runtime boundary (compile only; no session execution).
 *
 * Authoritative Script → Playable Compiler → PlayableProject → (P7.1+) Content Runtime
 */

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, maximum = 4000) {
  return String(value ?? "").trim().slice(0, maximum);
}

function cleanId(value) {
  return cleanText(value, 120);
}

export const PLAYABLE_PROJECT_SCHEMA_VERSION = 1;

export const PLAYABLE_PROJECT_STATUSES = Object.freeze(["DRAFT", "READY", "INVALID", "STALE"]);

export const PLAYABLE_ROLE_TYPES = Object.freeze(["PLAYER", "HOST", "NPC"]);

export const CONTENT_UNIT_TYPES = Object.freeze(["TEXT", "CLUE", "REVEAL", "CHOICE", "SYSTEM"]);

export const CONTENT_VISIBILITY = Object.freeze(["PRIVATE", "SHARED", "PUBLIC", "HOST_ONLY"]);

export const CONTENT_DELIVERY = Object.freeze(["AUTO_ON_STAGE", "HOST_RELEASE", "CONDITION_UNLOCK"]);

export const CLUE_DELIVERY = Object.freeze(["HOST_RELEASE", "AUTO", "CONDITION_UNLOCK"]);

export const SOURCE_TYPES = Object.freeze([
  "HOST_SCRIPT",
  "CHARACTER_SCRIPT",
  "CLUE",
  "SYSTEM_AUTHORED",
  "FIXTURE",
]);

export const MECHANISM_TRIGGERS = Object.freeze(["HOST_START", "AUTO", "CONDITION"]);

export const PARTICIPANT_RULE_TYPES = Object.freeze(["ALL_PLAYERS", "ROLE_IDS", "EXCLUDE_ROLE_IDS"]);

export const EFFECT_TYPES = Object.freeze([
  "PERMISSION_GRANT",
  "PERMISSION_REVOKE",
  "STATE_APPLY",
  "STATE_CLEAR",
]);

export const PERMISSION_GRANT_KINDS = Object.freeze(["VIEW_CONTENT", "RECEIVE_CLUE", "ENTER_MECHANISM"]);

export const DIAGNOSTIC_SEVERITIES = Object.freeze(["INFO", "WARN", "ERROR"]);

export const DIAGNOSTIC_CODES = Object.freeze([
  "MISSING_ROLE_CONTENT",
  "UNKNOWN_ROLE_REF",
  "UNKNOWN_STAGE_REF",
  "ORPHAN_CONTENT",
  "ORPHAN_CLUE",
  "UNKNOWN_MECHANISM",
  "INVALID_MECHANISM_PARTICIPANTS",
  "INVALID_OUTCOME_BINDING",
  "DUPLICATE_ID",
  "MISSING_START_STAGE",
  "INVALID_EFFECT",
  "MISSING_SOURCE_REF",
  "CLUE_CONTENT_MISMATCH",
]);

export function normalizeSourceRef(value = {}) {
  const src = record(value);
  const sourceType = SOURCE_TYPES.includes(src.sourceType) ? src.sourceType : "FIXTURE";
  return {
    sourceType,
    sourceDocumentId: cleanId(src.sourceDocumentId) || undefined,
    characterId: cleanId(src.characterId) || undefined,
    stageId: cleanId(src.stageId) || undefined,
    sectionId: cleanId(src.sectionId) || undefined,
    paragraphRange: cleanText(src.paragraphRange, 80) || undefined,
    label: cleanText(src.label, 160) || undefined,
  };
}

export function normalizePermissionDefinition(value = {}) {
  const src = record(value);
  return {
    id: cleanId(src.id),
    grants: asArray(src.grants)
      .map(String)
      .filter((g) => PERMISSION_GRANT_KINDS.includes(g)),
    contentUnitIds: asArray(src.contentUnitIds).map(String),
    clueIds: asArray(src.clueIds).map(String),
    summary: cleanText(src.summary, 200) || undefined,
  };
}

export function normalizeRuntimeEffect(value = {}) {
  const src = record(value);
  const type = EFFECT_TYPES.includes(src.type) ? src.type : null;
  if (!type) {
    return { type: "INVALID", raw: src, valid: false, error: "UNKNOWN_EFFECT_TYPE" };
  }
  if (type === "PERMISSION_GRANT" || type === "PERMISSION_REVOKE") {
    const permissionId = cleanId(src.permissionId);
    const target = cleanText(src.target, 80) || "WINNER";
    const valid = Boolean(permissionId);
    return { type, permissionId, target, valid, error: valid ? undefined : "MISSING_PERMISSION_ID" };
  }
  if (type === "STATE_APPLY") {
    const key = cleanId(src.key);
    const valid = Boolean(key);
    return {
      type,
      key,
      value: src.value === undefined ? null : src.value,
      valid,
      error: valid ? undefined : "MISSING_STATE_KEY",
    };
  }
  // STATE_CLEAR
  const key = cleanId(src.key);
  const valid = Boolean(key);
  return { type, key, valid, error: valid ? undefined : "MISSING_STATE_KEY" };
}

export function validateRuntimeEffect(value) {
  const effect = normalizeRuntimeEffect(value);
  return { ok: effect.valid !== false && effect.type !== "INVALID", effect };
}

export function normalizeOutcomeBinding(value = {}) {
  const src = record(value);
  const effects = asArray(src.effects).map(normalizeRuntimeEffect);
  return {
    outcomeMatcher: record(src.outcomeMatcher),
    effects,
  };
}

export function normalizeParticipantRule(value = {}) {
  const src = record(value);
  const type = PARTICIPANT_RULE_TYPES.includes(src.type) ? src.type : "ALL_PLAYERS";
  return {
    type,
    roleIds: asArray(src.roleIds).map(String),
  };
}

export function normalizeCompileDiagnostic(value = {}) {
  const src = record(value);
  return {
    severity: DIAGNOSTIC_SEVERITIES.includes(src.severity) ? src.severity : "WARN",
    code: DIAGNOSTIC_CODES.includes(src.code) ? src.code : cleanText(src.code, 80) || "UNKNOWN",
    message: cleanText(src.message, 600),
    sourceRefs: asArray(src.sourceRefs).map(normalizeSourceRef),
  };
}

export function normalizePlayableRole(value = {}) {
  const src = record(value);
  return {
    id: cleanId(src.id),
    characterId: cleanId(src.characterId) || undefined,
    name: cleanText(src.name, 80) || cleanId(src.id),
    type: PLAYABLE_ROLE_TYPES.includes(src.type) ? src.type : "PLAYER",
    playerAssignable: src.playerAssignable !== false && src.type !== "HOST",
    sourceRefs: asArray(src.sourceRefs).map(normalizeSourceRef),
  };
}

export function normalizeContentUnit(value = {}) {
  const src = record(value);
  const audience = record(src.audience);
  return {
    id: cleanId(src.id),
    type: CONTENT_UNIT_TYPES.includes(src.type) ? src.type : "TEXT",
    stageId: cleanId(src.stageId),
    audience: {
      roleIds: asArray(audience.roleIds).map(String),
      visibility: CONTENT_VISIBILITY.includes(audience.visibility)
        ? audience.visibility
        : "PRIVATE",
    },
    delivery: CONTENT_DELIVERY.includes(src.delivery) ? src.delivery : "AUTO_ON_STAGE",
    content: String(src.content ?? ""),
    title: cleanText(src.title, 160) || undefined,
    unlockCondition: src.unlockCondition != null ? record(src.unlockCondition) : undefined,
    sourceRef: normalizeSourceRef(src.sourceRef),
    metadata: src.metadata != null ? record(src.metadata) : undefined,
  };
}

export function normalizePlayableClue(value = {}) {
  const src = record(value);
  return {
    id: cleanId(src.id),
    title: cleanText(src.title, 160) || cleanId(src.id),
    contentUnitId: cleanId(src.contentUnitId),
    stageId: cleanId(src.stageId),
    defaultAudience: {
      roleIds: asArray(record(src.defaultAudience).roleIds).map(String),
      visibility: CONTENT_VISIBILITY.includes(record(src.defaultAudience).visibility)
        ? record(src.defaultAudience).visibility
        : "PUBLIC",
    },
    delivery: CLUE_DELIVERY.includes(src.delivery) ? src.delivery : "HOST_RELEASE",
    repeatable: Boolean(src.repeatable),
    sourceRef: normalizeSourceRef(src.sourceRef),
  };
}

export function normalizeMechanismPlacement(value = {}) {
  const src = record(value);
  return {
    id: cleanId(src.id),
    mechanismTemplateId: cleanId(src.mechanismTemplateId),
    familyId: cleanId(src.familyId),
    stageId: cleanId(src.stageId),
    title: cleanText(src.title, 160) || cleanId(src.id),
    trigger: MECHANISM_TRIGGERS.includes(src.trigger) ? src.trigger : "HOST_START",
    participantRule: normalizeParticipantRule(src.participantRule),
    introContentUnitId: cleanId(src.introContentUnitId) || undefined,
    runtimeConfig: record(src.runtimeConfig),
    outcomeBindings: asArray(src.outcomeBindings).map(normalizeOutcomeBinding),
    fallback: src.fallback != null ? record(src.fallback) : undefined,
    sourceRef: src.sourceRef != null ? normalizeSourceRef(src.sourceRef) : undefined,
  };
}

export function normalizePlayableStage(value = {}) {
  const src = record(value);
  return {
    id: cleanId(src.id),
    order: Number.isFinite(Number(src.order)) ? Number(src.order) : 0,
    title: cleanText(src.title, 120) || cleanId(src.id),
    stageRole: cleanText(src.stageRole, 40) || undefined,
    contentUnitIds: asArray(src.contentUnitIds).map(String),
    clueIds: asArray(src.clueIds).map(String),
    mechanismPlacementIds: asArray(src.mechanismPlacementIds).map(String),
    enterCondition: src.enterCondition != null ? record(src.enterCondition) : undefined,
    exitCondition: src.exitCondition != null ? record(src.exitCondition) : undefined,
    sourceRefs: asArray(src.sourceRefs).map(normalizeSourceRef),
  };
}

/** Stable fingerprint of authoritative / fixture source for stale detection */
export function playableSourceFingerprint(source = {}) {
  const src = record(source);
  return cleanText(
    `${src.sourceType || "FIXTURE"}|${src.sourceId || ""}|${src.sourceRevision || ""}|${src.fixtureId || ""}`,
    400,
  );
}

export function normalizePlayableProject(value) {
  if (value == null) return null;
  const src = record(value);
  const status = PLAYABLE_PROJECT_STATUSES.includes(src.status) ? src.status : "DRAFT";
  const source = record(src.source);
  const runtimeConfig = record(src.runtimeConfig);
  return {
    schemaVersion: PLAYABLE_PROJECT_SCHEMA_VERSION,
    id: cleanId(src.id) || `pp-${Math.random().toString(36).slice(2, 8)}`,
    worldId: cleanId(src.worldId) || undefined,
    title: cleanText(src.title, 160) || "Playable Project",
    status,
    isStale: Boolean(src.isStale) || status === "STALE",
    source: {
      sourceType: cleanText(source.sourceType, 40) || "FIXTURE",
      sourceId: cleanId(source.sourceId) || undefined,
      sourceRevision: cleanText(source.sourceRevision, 200) || undefined,
      fixtureId: cleanId(source.fixtureId) || undefined,
      fingerprint: cleanText(source.fingerprint, 400) || playableSourceFingerprint(source),
      compiledAt: source.compiledAt != null ? String(source.compiledAt) : null,
    },
    roles: asArray(src.roles).map(normalizePlayableRole),
    stages: asArray(src.stages).map(normalizePlayableStage).sort((a, b) => a.order - b.order),
    contentUnits: asArray(src.contentUnits).map(normalizeContentUnit),
    clues: asArray(src.clues).map(normalizePlayableClue),
    mechanismPlacements: asArray(src.mechanismPlacements).map(normalizeMechanismPlacement),
    permissions: asArray(src.permissions).map(normalizePermissionDefinition),
    runtimeConfig: {
      startStageId: cleanId(runtimeConfig.startStageId),
      finalStageId: cleanId(runtimeConfig.finalStageId) || undefined,
      allowHostOverride: runtimeConfig.allowHostOverride !== false,
      // Session principle: running rooms pin the playable snapshot at open time (P7.1+).
      pinSnapshotOnSessionStart: runtimeConfig.pinSnapshotOnSessionStart !== false,
    },
    diagnostics: asArray(src.diagnostics).map(normalizeCompileDiagnostic),
    revision: Math.max(0, Math.trunc(Number(src.revision) || 0)),
    updatedAt: src.updatedAt != null ? String(src.updatedAt) : null,
  };
}

export function refreshPlayableProjectStale(project, { sourceFingerprint } = {}) {
  const next = normalizePlayableProject(project);
  if (!next) return null;
  if (sourceFingerprint != null && sourceFingerprint !== next.source.fingerprint) {
    next.isStale = true;
    if (next.status === "READY") next.status = "STALE";
  }
  return next;
}

/** Compile-time inspection: content units a role could ever be audience for (not stage-gated). */
export function listContentUnitsForRole(project, roleId) {
  const pp = normalizePlayableProject(project);
  if (!pp) return [];
  const role = pp.roles.find((r) => r.id === roleId);
  if (!role) return [];
  return pp.contentUnits.filter((cu) => {
    if (cu.audience.visibility === "PUBLIC") return role.type === "PLAYER" || role.type === "HOST";
    if (cu.audience.visibility === "HOST_ONLY") return role.type === "HOST";
    if (cu.audience.visibility === "PRIVATE" || cu.audience.visibility === "SHARED") {
      return cu.audience.roleIds.includes(roleId);
    }
    return false;
  });
}
