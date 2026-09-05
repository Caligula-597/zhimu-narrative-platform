/**
 * P6.0 ProductionMasterDraft contracts — Deterministic First
 * 既有 MasterOutlineDraft 的展开视图；禁止静默改结构。
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

/** P6.x Projection Correctness bumps contract shape (contributions / clue lifecycle / truth flags). */
export const PRODUCTION_MASTER_DRAFT_VERSION = 2;

export const CHARACTER_BEAT_ROLES = Object.freeze([
  "OWNER",
  "PARTICIPANT",
  "TARGET",
  "WITNESS",
  "AFFECTED",
]);

export const EVIDENCE_EFFECTS = Object.freeze(["MISLEADING", "SUPPORTING", "NEUTRAL"]);
export const CLAIM_TRUTH_VALUES = Object.freeze(["TRUE", "FALSE", "UNKNOWN"]);

export const PRODUCTION_DRAFT_STATUSES = Object.freeze([
  "DRAFT",
  "USER_REVIEWED",
  "STALE",
]);

export const MASTER_DRAFT_WARNING_TYPES = Object.freeze([
  "STAGE_CROWDING",
  "LOW_WEAVE_DENSITY",
  "ROLE_OVERLOAD",
  "NEEDS_DETAIL",
  "MISSING_CAUSAL_LINK",
  "MISSING_CLUE_DETAIL",
  "PARALLEL_HEAVY",
  "UNRESOLVED_CONFLICT",
]);

export const STRUCTURE_CHANGE_TYPES = Object.freeze([
  "MOVE_BEAT",
  "SPLIT_STAGE",
  "REBALANCE_STAGE",
  "MERGE_STAGE",
  "CREATE_WEAVE",
  "BREAK_WEAVE",
  "CHANGE_ROLE_BINDING",
]);

export const STRUCTURE_CHANGE_STATUSES = Object.freeze([
  "PROPOSED",
  "ACCEPTED",
  "REJECTED",
  "APPLIED",
]);

export const EDIT_KINDS = Object.freeze(["CONTENT_EDIT", "STRUCTURE_EDIT"]);

/** 稳定结构指纹，用作 sourceMasterOutlineRevision */
export function outlineStructureRevision(outline) {
  if (!outline) return "outline:none";
  const stages = asArray(outline.stages)
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((s) => {
      const beats = asArray(s.beats)
        .map((b) => `${b.id}|${b.sourceBlockId}|${b.sourceBeatId}`)
        .join(",");
      return `${s.id}@${s.order}:{${beats}}`;
    })
    .join(";");
  const weaves = asArray(outline.weaveLinks)
    .filter((l) => l.status !== "SPLIT")
    .map((l) => `${l.id}:${l.kind}:${(l.beatIds || []).join(",")}`)
    .sort()
    .join("|");
  return `v1:${outline.id || "mod"}:${stages}#${weaves}`;
}

export function normalizeMasterDraftWarning(value = {}) {
  const src = record(value);
  const type = MASTER_DRAFT_WARNING_TYPES.includes(src.type) ? src.type : "NEEDS_DETAIL";
  return {
    id: cleanId(src.id) || `warn-${Math.random().toString(36).slice(2, 8)}`,
    type,
    severity: cleanText(src.severity, 20) || "info",
    message: cleanText(src.message, 600),
    stageIds: asArray(src.stageIds).map(String),
    beatIds: asArray(src.beatIds).map(String),
  };
}

export function normalizeStructureChangeRequest(value = {}) {
  const src = record(value);
  const type = STRUCTURE_CHANGE_TYPES.includes(src.type) ? src.type : "MOVE_BEAT";
  const status = STRUCTURE_CHANGE_STATUSES.includes(src.status) ? src.status : "PROPOSED";
  return {
    id: cleanId(src.id) || `scr-${Math.random().toString(36).slice(2, 8)}`,
    type,
    sourceStageIds: asArray(src.sourceStageIds).map(String),
    sourceBeatIds: asArray(src.sourceBeatIds).map(String),
    sourceBlockIds: asArray(src.sourceBlockIds).map(String),
    reason: cleanText(src.reason, 600),
    severity: cleanText(src.severity, 20) || "info",
    proposal: cleanText(src.proposal, 800),
    status,
  };
}

export function normalizeProductionBeatDraft(value = {}) {
  const src = record(value);
  return {
    id: cleanId(src.id) || `pbeat-${Math.random().toString(36).slice(2, 8)}`,
    sourceBeatId: cleanId(src.sourceBeatId),
    sourceOutlineBeatId: cleanId(src.sourceOutlineBeatId),
    sourceBlockId: cleanId(src.sourceBlockId),
    sourceMechanismId: cleanId(src.sourceMechanismId) || cleanId(src.sourceBlockId),
    templateId: cleanId(src.templateId),
    familyId: cleanId(src.familyId),
    actors: asArray(src.actors).map((a) => {
      const row = record(a);
      return {
        id: cleanId(row.id),
        name: cleanText(row.name, 80) || cleanId(row.id),
      };
    }),
    ownerCharacterIds: asArray(src.ownerCharacterIds).map(String).filter(Boolean),
    goal: cleanText(src.goal, 200) || undefined,
    action: cleanText(src.action, 200) || undefined,
    target: cleanText(src.target, 160) || undefined,
    setupContext: cleanText(src.setupContext, 400),
    eventSummary: cleanText(src.eventSummary, 800),
    immediateConsequence: cleanText(src.immediateConsequence, 400),
    requires: asArray(src.requires),
    produces: asArray(src.produces),
    playerKnowledge: cleanText(src.playerKnowledge, 400),
    hostTruth: cleanText(src.hostTruth, 400),
    clueRefs: asArray(src.clueRefs).map(String),
    relatedCharacterIds: asArray(src.relatedCharacterIds).map(String),
    relationQuality: cleanText(src.relationQuality, 40) || undefined,
    weaveLinkIds: asArray(src.weaveLinkIds).map(String),
    relationNotes: asArray(src.relationNotes).map((t) => cleanText(t, 400)).filter(Boolean),
    needsDetail: Boolean(src.needsDetail),
    detailReason: cleanText(src.detailReason, 300) || undefined,
    contentConfirmed: Boolean(src.contentConfirmed),
  };
}

export function normalizeProductionStageDraft(value = {}) {
  const src = record(value);
  return {
    stageId: cleanId(src.stageId),
    stageRole: cleanText(src.stageRole, 40) || cleanText(src.title, 40),
    title: cleanText(src.title, 120) || "阶段",
    order: Number.isFinite(Number(src.order)) ? Number(src.order) : 0,
    purpose: cleanText(src.purpose, 400),
    beats: asArray(src.beats).map(normalizeProductionBeatDraft),
    playerVisibleSummary: cleanText(src.playerVisibleSummary, 600),
    hostTruthSummary: cleanText(src.hostTruthSummary, 600),
    stageStartState: cleanText(src.stageStartState, 400),
    stageEndState: cleanText(src.stageEndState, 400),
    clueEntries: asArray(src.clueEntries),
    characterEntries: asArray(src.characterEntries),
    unresolvedDetails: asArray(src.unresolvedDetails).map((t) => cleanText(t, 300)).filter(Boolean),
    warnings: asArray(src.warnings).map(normalizeMasterDraftWarning),
  };
}

export function normalizeCharacterContribution(value = {}) {
  const src = record(value);
  const roleInBeat = CHARACTER_BEAT_ROLES.includes(src.roleInBeat) ? src.roleInBeat : "PARTICIPANT";
  return {
    sourceBeatId: cleanId(src.sourceBeatId),
    sourceOutlineBeatId: cleanId(src.sourceOutlineBeatId),
    sourceBlockId: cleanId(src.sourceBlockId),
    familyId: cleanId(src.familyId) || undefined,
    templateId: cleanId(src.templateId) || undefined,
    roleInBeat,
    goal: src.goal != null ? cleanText(src.goal, 200) : null,
    action: src.action != null ? cleanText(src.action, 200) : null,
    gainedInfo: src.gainedInfo != null ? cleanText(src.gainedInfo, 300) : null,
    relationQuality: cleanText(src.relationQuality, 40) || undefined,
    needsDetail: Boolean(src.needsDetail),
  };
}

export function normalizeTruthView(value = {}) {
  const src = record(value);
  return {
    events: asArray(src.events).map((e) => {
      const row = record(e);
      const evidenceEffect = EVIDENCE_EFFECTS.includes(row.evidenceEffect)
        ? row.evidenceEffect
        : row.isMisleading
          ? "MISLEADING"
          : "NEUTRAL";
      const claimTruth = CLAIM_TRUTH_VALUES.includes(row.claimTruth)
        ? row.claimTruth
        : evidenceEffect === "MISLEADING"
          ? "FALSE"
          : evidenceEffect === "SUPPORTING"
            ? "TRUE"
            : "UNKNOWN";
      const eventOccurred = row.eventOccurred !== false;
      return {
        beatId: cleanId(row.beatId),
        stageId: cleanId(row.stageId),
        whatHappened: cleanText(row.whatHappened, 600),
        who: asArray(row.who).map(String),
        why: cleanText(row.why, 300) || "UNKNOWN",
        consequence: cleanText(row.consequence, 300) || "UNKNOWN",
        eventOccurred,
        evidenceEffect,
        claimTruth,
        /** @deprecated use evidenceEffect === MISLEADING */
        isMisleading: evidenceEffect === "MISLEADING" || Boolean(row.isMisleading),
        /** @deprecated use eventOccurred — true means the event happened, not that the claim is true */
        isTruth: eventOccurred,
        needsDetail: Boolean(row.needsDetail),
      };
    }),
  };
}

function uniqueJoin(values, separator = "；") {
  const out = [];
  const seen = new Set();
  for (const raw of values || []) {
    const text = String(raw || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out.join(separator);
}

export function normalizeCharacterViews(value = {}) {
  const src = record(value);
  return {
    characters: asArray(src.characters).map((c) => {
      const row = record(c);
      return {
        characterId: cleanId(row.characterId),
        name: cleanText(row.name, 80),
        stages: asArray(row.stages).map((s) => {
          const st = record(s);
          const contributions = asArray(st.contributions).map(normalizeCharacterContribution);
          const owners = contributions.filter((x) => x.roleInBeat === "OWNER");
          const derivedGoal =
            uniqueJoin(owners.map((x) => x.goal)) ||
            cleanText(st.goal, 400) ||
            (contributions.length ? "本阶段无独立主目标（参与/对象）" : "NEEDS_DETAIL");
          const derivedAction =
            uniqueJoin(owners.map((x) => x.action)) ||
            cleanText(st.action, 400) ||
            (contributions.length ? "见 contributions" : "NEEDS_DETAIL");
          return {
            stageId: cleanId(st.stageId),
            contributions,
            stageSummary: cleanText(st.stageSummary, 600) || derivedGoal,
            knows: cleanText(st.knows, 400) || "NEEDS_DETAIL",
            /** Derived from OWNER contributions only — not a single overwritten beat */
            goal: derivedGoal,
            action: derivedAction,
            relationChanges: asArray(st.relationChanges).map((t) => cleanText(t, 200)).filter(Boolean),
            gainedInfo: cleanText(st.gainedInfo, 400) || "NEEDS_DETAIL",
            misunderstanding: cleanText(st.misunderstanding, 300) || "NEEDS_DETAIL",
            endChange: cleanText(st.endChange, 300) || "NEEDS_DETAIL",
            needsDetail: Boolean(st.needsDetail) || contributions.some((x) => x.needsDetail),
          };
        }),
      };
    }),
  };
}

export function normalizeClueView(value = {}) {
  const src = record(value);
  return {
    clues: asArray(src.clues).map((c) => {
      const row = record(c);
      const availableStages = asArray(row.availableStages).map(String);
      const introducedAt = cleanId(row.introducedAt) || availableStages[0] || cleanId(row.stageId);
      const stages = availableStages.length ? availableStages : introducedAt ? [introducedAt] : [];
      return {
        clueId: cleanId(row.clueId) || cleanText(row.label, 80) || "unknown-clue",
        label: cleanText(row.label, 160),
        mechanismId: cleanId(row.mechanismId),
        templateId: cleanId(row.templateId),
        introducedAt,
        availableStages: stages,
        persists: row.persists != null ? Boolean(row.persists) : stages.length > 1,
        /** @deprecated prefer introducedAt / availableStages — first stage for legacy readers */
        stageId: cleanId(row.stageId) || introducedAt,
        possibleFinders: asArray(row.possibleFinders).map(String),
        supportsFact: cleanText(row.supportsFact, 200) || "NEEDS_DETAIL",
        isMisleading: Boolean(row.isMisleading),
        isDecisive: Boolean(row.isDecisive),
        missingDetail: Boolean(row.missingDetail),
        detailNote: cleanText(row.detailNote, 300) || undefined,
      };
    }),
  };
}

function normalizeGameInsertionPoint(value = {}) {
  const slot = record(value);
  return {
    placementId: cleanId(slot.placementId) || `slot-${Math.random().toString(36).slice(2, 6)}`,
    hint: cleanText(slot.hint, 200),
    afterBeatId: cleanId(slot.afterBeatId) || undefined,
  };
}

export function normalizeExecutionView(value = {}) {
  const src = record(value);
  return {
    stages: asArray(src.stages).map((s) => {
      const row = record(s);
      const points = asArray(
        row.candidateGameInsertionPoints?.length
          ? row.candidateGameInsertionPoints
          : row.gameMechanismSlots,
      ).map(normalizeGameInsertionPoint);
      return {
        stageId: cleanId(row.stageId),
        openingState: cleanText(row.openingState, 400),
        stageGoal: cleanText(row.stageGoal, 400),
        beatsToAdvance: asArray(row.beatsToAdvance).map(String),
        cluesAvailable: asArray(row.cluesAvailable).map(String),
        charactersInPlay: asArray(row.charactersInPlay).map(String),
        candidateGameInsertionPoints: points,
        /** @deprecated alias — product meaning is candidate insertion points, not required GAME slots */
        gameMechanismSlots: points,
        requiredStateBeforeNext: cleanText(row.requiredStateBeforeNext, 400),
      };
    }),
  };
}

export function normalizeProductionMasterDraft(value) {
  if (value == null) return null;
  const src = record(value);
  const status = PRODUCTION_DRAFT_STATUSES.includes(src.status) ? src.status : "DRAFT";
  return {
    id: cleanId(src.id) || `pmd-${Math.random().toString(36).slice(2, 8)}`,
    version: PRODUCTION_MASTER_DRAFT_VERSION,
    projectId: cleanId(src.projectId) || "project",
    sourceStoryStateRevision: Math.max(0, Math.trunc(Number(src.sourceStoryStateRevision) || 0)),
    sourceMasterOutlineId: cleanId(src.sourceMasterOutlineId),
    sourceMasterOutlineRevision: cleanText(src.sourceMasterOutlineRevision, 4000) || "outline:none",
    title: cleanText(src.title, 160) || undefined,
    premiseSummary: cleanText(src.premiseSummary, 600) || undefined,
    stages: asArray(src.stages).map(normalizeProductionStageDraft).sort((a, b) => a.order - b.order),
    truthView: normalizeTruthView(src.truthView),
    characterViews: normalizeCharacterViews(src.characterViews),
    clueView: normalizeClueView(src.clueView),
    executionView: normalizeExecutionView(src.executionView),
    warnings: asArray(src.warnings).map(normalizeMasterDraftWarning),
    structureChangeRequests: asArray(src.structureChangeRequests).map(normalizeStructureChangeRequest),
    status,
    revision: Math.max(0, Math.trunc(Number(src.revision) || 0)),
    updatedAt: src.updatedAt != null ? String(src.updatedAt) : null,
  };
}

export function emptyProductionMasterDraft(partial = {}) {
  return normalizeProductionMasterDraft({
    id: partial.id,
    projectId: partial.projectId,
    sourceStoryStateRevision: partial.sourceStoryStateRevision ?? 0,
    sourceMasterOutlineId: partial.sourceMasterOutlineId,
    sourceMasterOutlineRevision: partial.sourceMasterOutlineRevision,
    title: partial.title,
    premiseSummary: partial.premiseSummary,
    stages: partial.stages || [],
    truthView: partial.truthView || { events: [] },
    characterViews: partial.characterViews || { characters: [] },
    clueView: partial.clueView || { clues: [] },
    executionView: partial.executionView || { stages: [] },
    warnings: partial.warnings || [],
    structureChangeRequests: partial.structureChangeRequests || [],
    status: partial.status || "DRAFT",
    revision: partial.revision ?? 0,
    updatedAt: partial.updatedAt || new Date().toISOString(),
  });
}

/** 若源 revision 已变，标记 STALE（不自动重算） */
export function refreshProductionDraftStaleStatus(draft, { storyRevision, outline } = {}) {
  const next = normalizeProductionMasterDraft(draft);
  if (!next) return null;
  const outlineRev = outline ? outlineStructureRevision(outline) : next.sourceMasterOutlineRevision;
  const storyStale =
    storyRevision != null && Number(storyRevision) !== Number(next.sourceStoryStateRevision);
  const outlineStale = outlineRev !== next.sourceMasterOutlineRevision;
  if (storyStale || outlineStale) {
    next.status = "STALE";
  }
  return next;
}
