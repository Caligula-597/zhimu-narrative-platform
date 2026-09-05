/**
 * P9.2 GameNarrativePlan — PMD sidecar (does not mutate PMD V2).
 * Placement must be explicitly accepted; preferences alone never auto-place.
 */

import { normalizeRuntimeEffect } from "./playable-project-contracts.js";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, maximum = 400) {
  return String(value ?? "").trim().slice(0, maximum);
}

function cleanId(value) {
  return cleanText(value, 120).replace(/[^a-zA-Z0-9_\-.:]/g, "_");
}

export const GAME_NARRATIVE_PLAN_VERSION = 1;

export const GAME_NARRATIVE_KINDS = Object.freeze(["MID_STORY_GAME", "FINAL_SETTLEMENT_GAME"]);

export const GAME_NARRATIVE_SUPPORTED_FAMILIES = Object.freeze(["M03", "M09"]);

export function normalizeContentBinding(value = {}) {
  const src = record(value);
  return {
    permissionId: cleanId(src.permissionId),
    clueIds: asArray(src.clueIds).map(cleanId).filter(Boolean),
    contentUnitIds: asArray(src.contentUnitIds).map(cleanId).filter(Boolean),
    target: cleanText(src.target, 40) || "WINNER",
  };
}

export function normalizeNarrativeOutcome(value = {}) {
  const src = record(value);
  const effects = asArray(src.effects).map((e) => normalizeRuntimeEffect(e));
  return {
    outcomeMatcher: record(src.outcomeMatcher),
    narrativeMeaning: cleanText(src.narrativeMeaning, 400),
    effects,
    contentBindings: asArray(src.contentBindings).map(normalizeContentBinding),
  };
}

export function normalizeGameNarrativeBinding(value = {}) {
  const src = record(value);
  const narrative = record(src.narrative);
  const stake = record(narrative.stake);
  const familyId = cleanId(src.familyId) || cleanId(src.mechanismTemplateId).slice(0, 3);
  const kind = GAME_NARRATIVE_KINDS.includes(src.kind)
    ? src.kind
    : familyId === "M09"
      ? "FINAL_SETTLEMENT_GAME"
      : "MID_STORY_GAME";
  return {
    id: cleanId(src.id) || `gnb-${Math.random().toString(36).slice(2, 8)}`,
    mechanismTemplateId: cleanId(src.mechanismTemplateId) || `${familyId}-1`,
    familyId: familyId || "M03",
    kind,
    stageId: cleanId(src.stageId),
    afterBeatId: src.afterBeatId != null ? cleanId(src.afterBeatId) : null,
    sourceBeatIds: asArray(src.sourceBeatIds).map(cleanId).filter(Boolean),
    acceptedFromCandidate: Boolean(src.acceptedFromCandidate),
    selectionSource: cleanText(src.selectionSource, 40) || "EXPLICIT",
    narrative: {
      causeSummary: cleanText(narrative.causeSummary, 600),
      stake: {
        label: cleanText(stake.label, 160),
        contextBindingKey: stake.contextBindingKey != null ? cleanId(stake.contextBindingKey) : null,
      },
      participantReason: cleanText(narrative.participantReason, 400),
      publicPrompt: cleanText(narrative.publicPrompt, 600),
    },
    participantRule: record(src.participantRule).type
      ? {
          type: cleanText(src.participantRule.type, 40) || "ALL_PLAYERS",
          roleIds: asArray(src.participantRule.roleIds).map(String),
        }
      : { type: "ALL_PLAYERS", roleIds: [] },
    trigger: cleanText(src.trigger, 40) || "HOST_START",
    runtimeConfig: record(src.runtimeConfig),
    outcomes: asArray(src.outcomes).map(normalizeNarrativeOutcome),
    fallback: src.fallback != null ? record(src.fallback) : undefined,
    requiredForStageCompletion: Boolean(src.requiredForStageCompletion),
    status: cleanText(src.status, 40) || "DRAFT",
  };
}

export function normalizeGameNarrativePlan(value = {}) {
  const src = record(value);
  return {
    version: GAME_NARRATIVE_PLAN_VERSION,
    revision: Math.max(0, Math.trunc(Number(src.revision) || 0)),
    sourcePmdId: src.sourcePmdId != null ? cleanId(src.sourcePmdId) : null,
    sourcePmdRevision:
      src.sourcePmdRevision != null ? Math.max(0, Math.trunc(Number(src.sourcePmdRevision))) : null,
    sourceContextRevision:
      src.sourceContextRevision != null
        ? Math.max(0, Math.trunc(Number(src.sourceContextRevision)))
        : null,
    bindings: asArray(src.bindings).map(normalizeGameNarrativeBinding),
    updatedAt: src.updatedAt != null ? String(src.updatedAt) : null,
  };
}

/**
 * Explicit acceptance of a gameplay candidate into a placement binding stub.
 * Never auto-called from CreationSpec preferences alone.
 */
export function acceptGameplayPlacement({
  candidate = null,
  stageId,
  mechanismTemplateId,
  familyId = null,
  instanceKey = null,
  sourceBeatIds = [],
  afterBeatId = null,
  selectionSource = "EXPLICIT",
} = {}) {
  const fam =
    cleanId(familyId) ||
    cleanId(candidate?.familyId) ||
    cleanId(mechanismTemplateId).slice(0, 3) ||
    "M03";
  const template =
    cleanId(mechanismTemplateId) ||
    cleanId(candidate?.templateId) ||
    (fam === "M09" ? "M09-1" : "M03-1");
  const stage = cleanId(stageId) || cleanId(candidate?.stageId);
  const key = cleanId(instanceKey) || cleanId(candidate?.instanceKey) || `${fam}-${stage}`;
  return normalizeGameNarrativeBinding({
    id: `gnb-${key}`,
    mechanismTemplateId: template,
    familyId: fam,
    stageId: stage,
    afterBeatId,
    sourceBeatIds,
    acceptedFromCandidate: Boolean(candidate),
    selectionSource,
    kind: fam === "M09" ? "FINAL_SETTLEMENT_GAME" : "MID_STORY_GAME",
    requiredForStageCompletion: fam === "M09",
  });
}
