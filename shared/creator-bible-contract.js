/** Shared shapes for creator bible structural objects (frontend + backend). */

export const CLUE_KINDS = ["general", "deep", "verify", "misdirect", "emotion", "mechanic"];

export const CLUE_KIND_LABELS = {
  general: "一般",
  deep: "深入",
  verify: "验证",
  misdirect: "误导",
  emotion: "情感",
  mechanic: "机制"
};

export const ARC_STAGES = ["start", "conflict", "turn", "end"];

export function defaultRoleArc() {
  return { start: "", conflict: "", turn: "", end: "" };
}

export function normalizeRoleArc(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(ARC_STAGES.map((key) => [key, String(value[key] ?? "").trim()]));
}

/** Per-act / per-day outward form for body-swap scripts. True identity stays in hiddenIdentity. */
export function normalizeAppearanceStates(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 48)
    .map((row) => ({
      phaseLabel: String(row?.phaseLabel ?? row?.phase ?? "").trim().slice(0, 80),
      appearance: String(row?.appearance ?? "").trim().slice(0, 2000),
      notes: String(row?.notes ?? "").trim().slice(0, 2000)
    }))
    .filter((row) => row.phaseLabel || row.appearance || row.notes);
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
    appearanceStates: normalizeAppearanceStates(body.appearanceStates),
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

export function normalizeBeatPlan(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    goal: String(value.goal ?? "").trim(),
    durationMinutes: value.durationMinutes != null ? Number(value.durationMinutes) : null,
    dmTasks: String(value.dmTasks ?? "").trim(),
    playerActions: String(value.playerActions ?? "").trim(),
    advanceCondition: String(value.advanceCondition ?? "").trim()
  };
}

export const MATERIAL_BOOKLET_KINDS = ["diary", "catalog", "manual", "prop_book", "other"];

export const MATERIAL_BOOKLET_KIND_LABELS = {
  diary: "日记/私人册",
  catalog: "目录/图鉴",
  manual: "手册",
  prop_book: "道具册",
  other: "其他"
};

export const MATERIAL_BOOKLET_VISIBILITIES = ["host_only", "owner_role", "shared_roles", "public_table"];

export function normalizeMaterialPages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 80)
    .map((row, index) => ({
      pageLabel: String(row?.pageLabel ?? row?.label ?? "").trim().slice(0, 80),
      title: String(row?.title ?? "").trim().slice(0, 200),
      body: String(row?.body ?? "").trim().slice(0, 12000),
      sequence: Math.max(1, Number(row?.sequence) || index + 1)
    }))
    .filter((row) => row.pageLabel || row.title || row.body);
}

function normalizeUuidList(raw, max = 48) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(Boolean).map((id) => String(id)))].slice(0, max);
}

export function normalizeMaterialBookletBody(body = {}) {
  const kind = MATERIAL_BOOKLET_KINDS.includes(body.kind) ? body.kind : "diary";
  const visibility = MATERIAL_BOOKLET_VISIBILITIES.includes(body.visibility)
    ? body.visibility
    : "host_only";
  return {
    kind,
    title: String(body.title ?? "").trim().slice(0, 200),
    summary: String(body.summary ?? "").trim().slice(0, 4000),
    ownerRoleSlotId: body.ownerRoleSlotId || null,
    phaseLabel: String(body.phaseLabel ?? "").trim().slice(0, 80),
    chapterId: body.chapterId || null,
    visibility,
    pages: normalizeMaterialPages(body.pages),
    linkedClueIds: normalizeUuidList(body.linkedClueIds),
    linkedRoleSlotIds: normalizeUuidList(body.linkedRoleSlotIds),
    sequence: Math.max(1, Number(body.sequence) || 1),
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
  };
}
