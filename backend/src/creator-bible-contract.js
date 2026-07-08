/**
 * Backend creator bible contract — keep aligned with shared/creator-bible-contract.js
 */

export const CLUE_KINDS = ["general", "deep", "verify", "misdirect", "emotion", "mechanic"];

export const ARC_STAGES = ["start", "conflict", "turn", "end"];

export function defaultRoleArc() {
  return { start: "", conflict: "", turn: "", end: "" };
}

export function normalizeRoleArc(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(ARC_STAGES.map((key) => [key, String(value[key] ?? "").trim()]));
}

export function normalizeRoleArchiveBody(body = {}) {
  return {
    publicIdentity: String(body.publicIdentity ?? "").trim(),
    hiddenIdentity: String(body.hiddenIdentity ?? "").trim(),
    externalGoal: String(body.externalGoal ?? "").trim(),
    internalNeed: String(body.internalNeed ?? "").trim(),
    secret: String(body.secret ?? "").trim(),
    actionLine: String(body.actionLine ?? "").trim(),
    innerConflict: String(body.innerConflict ?? "").trim(),
    voiceHints: String(body.voiceHints ?? "").trim(),
    arc: normalizeRoleArc(body.arc),
    lies: Array.isArray(body.lies) ? body.lies.map((l) => String(l ?? "").trim()).filter(Boolean).slice(0, 12) : [],
    actTasks: Array.isArray(body.actTasks) ? body.actTasks.slice(0, 24) : [],
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
  };
}

export function normalizeCoreTrickBody(body = {}) {
  return {
    summary: String(body.summary ?? "").trim(),
    killerRoleSlotId: body.killerRoleSlotId || null,
    method: String(body.method ?? "").trim(),
    motive: String(body.motive ?? "").trim(),
    victim: String(body.victim ?? "").trim(),
    hostNotes: String(body.hostNotes ?? "").trim(),
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
  };
}

export function normalizeForeshadowBody(body = {}) {
  return {
    title: String(body.title ?? "").trim(),
    plantSummary: String(body.plantSummary ?? "").trim(),
    surfaceMeaning: String(body.surfaceMeaning ?? "").trim(),
    trueMeaning: String(body.trueMeaning ?? "").trim(),
    payoffSummary: String(body.payoffSummary ?? "").trim(),
    sequence: Math.max(1, Number(body.sequence) || 1),
    plantChapterId: body.plantChapterId || null,
    payoffChapterId: body.payoffChapterId || null,
    plantSectionId: body.plantSectionId || null,
    payoffSectionId: body.payoffSectionId || null,
    clueId: body.clueId || null,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
  };
}

export function normalizeTimelineEventBody(body = {}) {
  const participants = Array.isArray(body.participantRoleIds)
    ? body.participantRoleIds.filter(Boolean)
    : [];
  return {
    timeLabel: String(body.timeLabel ?? "").trim(),
    eventSummary: String(body.eventSummary ?? "").trim(),
    sequence: Math.max(1, Number(body.sequence) || 1),
    chapterId: body.chapterId || null,
    sceneId: body.sceneId || null,
    participantRoleIds: participants,
    alibiNotes: String(body.alibiNotes ?? "").trim(),
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
  };
}
