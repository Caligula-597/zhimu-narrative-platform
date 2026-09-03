import { randomUUID } from "node:crypto";

export const COMPILER_V2_STAGES = Object.freeze([
  "project_identify",
  "manuscript_ingest",
  "timeline_compiler",
  "scene_resolver",
  "clue_asset",
  "character_core",
  "mechanism_runtime",
  "integrity_check"
]);

export const DOCUMENT_KINDS = Object.freeze([
  "HOST_BOOK",
  "CHARACTER_BOOK",
  "CLUE_FILE",
  "SCENE_FILE",
  "MECHANISM_FILE",
  "OTHER"
]);

export const DETECTION_STATUS = Object.freeze({
  AUTO_DETECTED: "AUTO_DETECTED",
  NEEDS_CONFIRMATION: "NEEDS_CONFIRMATION"
});

/** Act assignment — never invent fallback Acts like「主持手册」「未分幕」. */
export const ACT_STATUS = Object.freeze({
  ASSIGNED: "ASSIGNED",
  UNASSIGNED: "UNASSIGNED"
});

export const TRUTH_STATUS = Object.freeze({
  CONFIRMED: "CONFIRMED",
  CHARACTER_BELIEF: "CHARACTER_BELIEF",
  FABRICATED: "FABRICATED",
  UNCERTAIN: "UNCERTAIN"
});

export const MECHANISM_MATCH = Object.freeze({
  MATCHED: "MATCHED",
  PARTIAL_MATCH: "PARTIAL_MATCH",
  CUSTOM_MECHANISM: "CUSTOM_MECHANISM"
});

export function newCompilerId(prefix = "cv2") {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/** Empty CompilerV2State — every stage reads/writes this object. */
export function createEmptyCompilerV2State({ worldId, jobId = null } = {}) {
  return {
    schemaVersion: 1,
    project: {
      worldId: worldId || null,
      title: null,
      titleStatus: DETECTION_STATUS.NEEDS_CONFIRMATION,
      playerCount: null,
      playerCountStatus: DETECTION_STATUS.NEEDS_CONFIRMATION,
      actCount: null,
      actCountStatus: DETECTION_STATUS.NEEDS_CONFIRMATION,
      creationType: "murder_mystery"
    },
    documents: [],
    characters: [],
    acts: [],
    characterScripts: [],
    sourceSections: [],
    timelineTracks: [],
    timelineEvents: [],
    scenes: [],
    clues: [],
    characterCores: [],
    mechanisms: [],
    warnings: [],
    unresolved: [],
    sourceRefs: [],
    job: {
      jobId,
      currentStage: "queued",
      status: "queued",
      completedStages: []
    }
  };
}

export function pushWarning(state, warning) {
  const next = { ...state, warnings: [...(state.warnings || [])] };
  next.warnings.push({
    id: newCompilerId("warn"),
    stage: state.job?.currentStage || null,
    code: warning.code || "WARNING",
    message: warning.message || "",
    evidence: warning.evidence || []
  });
  return next;
}

export function pushUnresolved(state, item) {
  const next = { ...state, unresolved: [...(state.unresolved || [])] };
  next.unresolved.push({
    id: newCompilerId("unres"),
    stage: state.job?.currentStage || null,
    kind: item.kind || "NEEDS_CONFIRMATION",
    field: item.field || null,
    message: item.message || "",
    evidence: item.evidence || [],
    suggestedValue: item.suggestedValue
  });
  return next;
}

export function markStageComplete(state, stageId) {
  const completed = new Set(state.job?.completedStages || []);
  completed.add(stageId);
  return {
    ...state,
    job: {
      ...(state.job || {}),
      currentStage: stageId,
      completedStages: [...completed]
    }
  };
}

export function summarizeStateForStatus(state) {
  return {
    schemaVersion: state.schemaVersion,
    project: state.project,
    counts: {
      documents: state.documents?.length || 0,
      characters: state.characters?.length || 0,
      acts: state.acts?.length || 0,
      characterScripts: state.characterScripts?.length || 0,
      sourceSections: state.sourceSections?.length || 0,
      timelineEvents: state.timelineEvents?.length || 0,
      scenes: state.scenes?.length || 0,
      clues: state.clues?.length || 0,
      characterCores: state.characterCores?.length || 0,
      mechanisms: state.mechanisms?.length || 0,
      warnings: state.warnings?.length || 0,
      unresolved: state.unresolved?.length || 0
    },
    job: state.job,
    warnings: (state.warnings || []).slice(0, 50),
    unresolved: (state.unresolved || []).slice(0, 50)
  };
}
