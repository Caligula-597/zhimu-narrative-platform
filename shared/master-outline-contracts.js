/**
 * Master Outline Integrator V1 — contracts
 *
 * 先编排、后写作。本文件只定义 MasterOutlineDraft 形状与规范化。
 */

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, maximum = 800) {
  return String(value ?? "").trim().slice(0, maximum);
}

function cleanId(value) {
  return cleanText(value, 120);
}

export const MASTER_OUTLINE_CONTRACT_VERSION = 1;

export const WEAVE_KINDS = Object.freeze([
  "WEAVE_CAUSAL",
  "WEAVE_STRONG",
  "WEAVE_SHARED_ACTION",
  "WEAVE_SHARED_SCENE",
  "WEAVE_SHARED_CHARACTER",
  "WEAVE_WEAK",
  "KEEP_PARALLEL",
]);

export const RELATION_QUALITIES = Object.freeze(["INTERWOVEN", "COLOCATED", "PARALLEL"]);

export function relationQualityForWeaveKind(kind) {
  if (kind === "WEAVE_CAUSAL" || kind === "WEAVE_STRONG" || kind === "WEAVE_SHARED_ACTION") {
    return "INTERWOVEN";
  }
  if (kind === "WEAVE_SHARED_SCENE" || kind === "WEAVE_SHARED_CHARACTER" || kind === "WEAVE_WEAK") {
    return "COLOCATED";
  }
  return "PARALLEL";
}

export const WEAVE_LINK_STATUSES = Object.freeze(["PROPOSED", "ACCEPTED", "SPLIT"]);

export const CONFLICT_DECISIONS = Object.freeze(["ACCEPT", "ADJUST", "IGNORE"]);

export const OUTLINE_DRAFT_STATUSES = Object.freeze(["DRAFT", "USER_ADJUSTED"]);

export function normalizeOutlineBeat(value = {}) {
  const src = record(value);
  return {
    id: cleanId(src.id) || `ob-${Math.random().toString(36).slice(2, 8)}`,
    sourceBlockId: cleanId(src.sourceBlockId),
    sourceBeatId: cleanId(src.sourceBeatId),
    familyId: cleanId(src.familyId),
    templateId: cleanId(src.templateId),
    blockTitle: cleanText(src.blockTitle, 160),
    summary: cleanText(src.summary, 800),
    phaseBand: Number.isFinite(Number(src.phaseBand)) ? Number(src.phaseBand) : 0,
    stageKey: cleanText(src.stageKey, 80),
    characterIds: asArray(src.characterIds).map(String),
    clueIds: asArray(src.clueIds).map(String),
    weaveGroupId: cleanId(src.weaveGroupId) || null,
    semantics: src.semantics || null,
    needsDetail: Boolean(src.needsDetail || src.semantics?.needsDetail),
  };
}

export function normalizeOutlineStage(value = {}) {
  const src = record(value);
  return {
    id: cleanId(src.id) || `stage-${Math.random().toString(36).slice(2, 6)}`,
    label: cleanText(src.label, 120) || "阶段",
    order: Number.isFinite(Number(src.order)) ? Number(src.order) : 0,
    beats: asArray(src.beats).map(normalizeOutlineBeat),
  };
}

export function normalizeWeaveLink(value = {}) {
  const src = record(value);
  const kind = WEAVE_KINDS.includes(src.kind) ? src.kind : "KEEP_PARALLEL";
  const status = WEAVE_LINK_STATUSES.includes(src.status) ? src.status : "PROPOSED";
  const relationQuality =
    RELATION_QUALITIES.includes(src.relationQuality)
      ? src.relationQuality
      : relationQualityForWeaveKind(kind);
  return {
    id: cleanId(src.id) || `wl-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    relationQuality,
    status,
    beatIds: asArray(src.beatIds).map(String),
    blockIds: asArray(src.blockIds).map(String),
    reason: cleanText(src.reason, 400),
    sharedCharacterIds: asArray(src.sharedCharacterIds).map(String),
    sharedFactKinds: asArray(src.sharedFactKinds).map(String),
    sharedTargets: asArray(src.sharedTargets).map(String),
  };
}

export function normalizeConflictItem(value = {}) {
  const src = record(value);
  const decision = CONFLICT_DECISIONS.includes(src.decision) ? src.decision : null;
  return {
    id: cleanId(src.id) || `cf-${Math.random().toString(36).slice(2, 8)}`,
    type: cleanText(src.type, 80) || "ROLE_OVERLOAD",
    severity: cleanText(src.severity, 40) || "warn",
    characterId: cleanId(src.characterId) || null,
    summary: cleanText(src.summary, 400),
    suggestions: asArray(src.suggestions).map((s) => {
      const row = record(s);
      return {
        id: cleanId(row.id) || cleanText(row.label, 40),
        label: cleanText(row.label, 160),
      };
    }),
    decision,
  };
}

export function normalizeCharacterLoadRow(value = {}) {
  const src = record(value);
  return {
    characterId: cleanId(src.characterId),
    name: cleanText(src.name, 80),
    totalLoad: Number(src.totalLoad) || 0,
    roles: asArray(src.roles).map((r) => {
      const row = record(r);
      return {
        blockId: cleanId(row.blockId),
        slotId: cleanText(row.slotId, 80),
        narrativeRole: cleanText(row.narrativeRole, 80),
        intensity: Number(row.intensity) || 1,
        intentionalOverlap: Boolean(row.intentionalOverlap),
      };
    }),
  };
}

/**
 * @returns {import('./master-outline-contracts.js').MasterOutlineDraft|null}
 */
export function normalizeMasterOutlineDraft(value) {
  if (value == null) return null;
  const src = record(value);
  const status = OUTLINE_DRAFT_STATUSES.includes(src.status) ? src.status : "DRAFT";
  return {
    id: cleanId(src.id) || `mod-${Math.random().toString(36).slice(2, 8)}`,
    version: MASTER_OUTLINE_CONTRACT_VERSION,
    sourceStoryStateRevision: Math.max(0, Math.trunc(Number(src.sourceStoryStateRevision) || 0)),
    sourceBlockIds: asArray(src.sourceBlockIds).map(String),
    createdAt: src.createdAt != null ? String(src.createdAt) : null,
    updatedAt: src.updatedAt != null ? String(src.updatedAt) : null,
    status,
    stages: asArray(src.stages).map(normalizeOutlineStage).sort((a, b) => a.order - b.order),
    weaveLinks: asArray(src.weaveLinks).map(normalizeWeaveLink),
    conflictReport: asArray(src.conflictReport).map(normalizeConflictItem),
    characterLoadReport: asArray(src.characterLoadReport).map(normalizeCharacterLoadRow),
  };
}

export function emptyMasterOutlineDraft(partial = {}) {
  return normalizeMasterOutlineDraft({
    id: partial.id,
    sourceStoryStateRevision: partial.sourceStoryStateRevision ?? 0,
    sourceBlockIds: partial.sourceBlockIds || [],
    createdAt: partial.createdAt || new Date().toISOString(),
    updatedAt: partial.updatedAt || null,
    status: "DRAFT",
    stages: partial.stages || [],
    weaveLinks: partial.weaveLinks || [],
    conflictReport: partial.conflictReport || [],
    characterLoadReport: partial.characterLoadReport || [],
  });
}
