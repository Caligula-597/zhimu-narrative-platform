/**
 * Backend creator bible contract — keep aligned with shared/creator-bible-contract.js
 */

export const CLUE_KINDS = ["general", "deep", "verify", "misdirect", "emotion", "mechanic"];

export const ARC_STAGES = ["start", "conflict", "turn", "end"];

function hasField(body, key) {
  return Object.hasOwn(body, key);
}

function patchString(body, key) {
  if (!hasField(body, key)) return undefined;
  return String(body[key] ?? "").trim();
}

function patchNullableUuid(body, key) {
  if (!hasField(body, key)) return undefined;
  return body[key] || null;
}

function pickDefined(patch = {}) {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}

export function defaultRoleArc() {
  return { start: "", conflict: "", turn: "", end: "" };
}

export function normalizeRoleArc(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(ARC_STAGES.map((key) => [key, String(value[key] ?? "").trim()]));
}

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

export function normalizeRoleArchivePatch(body = {}) {
  const patch = {};
  const publicIdentity = patchString(body, "publicIdentity");
  if (publicIdentity !== undefined) patch.publicIdentity = publicIdentity;
  const hiddenIdentity = patchString(body, "hiddenIdentity");
  if (hiddenIdentity !== undefined) patch.hiddenIdentity = hiddenIdentity;
  const externalGoal = patchString(body, "externalGoal");
  if (externalGoal !== undefined) patch.externalGoal = externalGoal;
  const internalNeed = patchString(body, "internalNeed");
  if (internalNeed !== undefined) patch.internalNeed = internalNeed;
  const secret = patchString(body, "secret");
  if (secret !== undefined) patch.secret = secret;
  const actionLine = patchString(body, "actionLine");
  if (actionLine !== undefined) patch.actionLine = actionLine;
  const innerConflict = patchString(body, "innerConflict");
  if (innerConflict !== undefined) patch.innerConflict = innerConflict;
  const voiceHints = patchString(body, "voiceHints");
  if (voiceHints !== undefined) patch.voiceHints = voiceHints;
  if (hasField(body, "arc")) patch.arc = normalizeRoleArc(body.arc);
  if (hasField(body, "lies")) {
    patch.lies = Array.isArray(body.lies) ? body.lies.map((l) => String(l ?? "").trim()).filter(Boolean).slice(0, 12) : [];
  }
  if (hasField(body, "actTasks")) {
    patch.actTasks = Array.isArray(body.actTasks) ? body.actTasks.slice(0, 24) : [];
  }
  if (hasField(body, "appearanceStates")) {
    patch.appearanceStates = normalizeAppearanceStates(body.appearanceStates);
  }
  if (hasField(body, "metadata")) {
    patch.metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  }
  return patch;
}

export function mergeRoleArchivePatch(existing, patch = {}) {
  const base = existing
    ? {
        publicIdentity: existing.publicIdentity ?? "",
        hiddenIdentity: existing.hiddenIdentity ?? "",
        externalGoal: existing.externalGoal ?? "",
        internalNeed: existing.internalNeed ?? "",
        secret: existing.secret ?? "",
        actionLine: existing.actionLine ?? "",
        innerConflict: existing.innerConflict ?? "",
        voiceHints: existing.voiceHints ?? "",
        arc: existing.arc ?? defaultRoleArc(),
        lies: existing.lies ?? [],
        actTasks: existing.actTasks ?? [],
        appearanceStates: existing.appearanceStates ?? [],
        metadata: existing.metadata ?? {}
      }
    : normalizeRoleArchiveBody({});
  return normalizeRoleArchiveBody({ ...base, ...pickDefined(patch) });
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

export function normalizeCoreTrickPatch(body = {}) {
  const patch = {};
  const summary = patchString(body, "summary");
  if (summary !== undefined) patch.summary = summary;
  const killerRoleSlotId = patchNullableUuid(body, "killerRoleSlotId");
  if (killerRoleSlotId !== undefined) patch.killerRoleSlotId = killerRoleSlotId;
  const method = patchString(body, "method");
  if (method !== undefined) patch.method = method;
  const motive = patchString(body, "motive");
  if (motive !== undefined) patch.motive = motive;
  const victim = patchString(body, "victim");
  if (victim !== undefined) patch.victim = victim;
  const hostNotes = patchString(body, "hostNotes");
  if (hostNotes !== undefined) patch.hostNotes = hostNotes;
  if (hasField(body, "metadata")) {
    patch.metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  }
  return patch;
}

export function mergeCoreTrickPatch(existing, patch = {}) {
  const base = existing
    ? {
        summary: existing.summary ?? "",
        killerRoleSlotId: existing.killerRoleSlotId ?? null,
        method: existing.method ?? "",
        motive: existing.motive ?? "",
        victim: existing.victim ?? "",
        hostNotes: existing.hostNotes ?? "",
        metadata: existing.metadata ?? {}
      }
    : normalizeCoreTrickBody({});
  return normalizeCoreTrickBody({ ...base, ...pickDefined(patch) });
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

export function normalizeForeshadowPatch(body = {}) {
  const patch = {};
  const title = patchString(body, "title");
  if (title !== undefined) patch.title = title;
  const plantSummary = patchString(body, "plantSummary");
  if (plantSummary !== undefined) patch.plantSummary = plantSummary;
  const surfaceMeaning = patchString(body, "surfaceMeaning");
  if (surfaceMeaning !== undefined) patch.surfaceMeaning = surfaceMeaning;
  const trueMeaning = patchString(body, "trueMeaning");
  if (trueMeaning !== undefined) patch.trueMeaning = trueMeaning;
  const payoffSummary = patchString(body, "payoffSummary");
  if (payoffSummary !== undefined) patch.payoffSummary = payoffSummary;
  if (hasField(body, "sequence")) patch.sequence = Math.max(1, Number(body.sequence) || 1);
  const plantChapterId = patchNullableUuid(body, "plantChapterId");
  if (plantChapterId !== undefined) patch.plantChapterId = plantChapterId;
  const payoffChapterId = patchNullableUuid(body, "payoffChapterId");
  if (payoffChapterId !== undefined) patch.payoffChapterId = payoffChapterId;
  const plantSectionId = patchNullableUuid(body, "plantSectionId");
  if (plantSectionId !== undefined) patch.plantSectionId = plantSectionId;
  const payoffSectionId = patchNullableUuid(body, "payoffSectionId");
  if (payoffSectionId !== undefined) patch.payoffSectionId = payoffSectionId;
  const clueId = patchNullableUuid(body, "clueId");
  if (clueId !== undefined) patch.clueId = clueId;
  if (hasField(body, "metadata")) {
    patch.metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  }
  return patch;
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

export function normalizeTimelineEventPatch(body = {}) {
  const patch = {};
  const timeLabel = patchString(body, "timeLabel");
  if (timeLabel !== undefined) patch.timeLabel = timeLabel;
  const eventSummary = patchString(body, "eventSummary");
  if (eventSummary !== undefined) patch.eventSummary = eventSummary;
  if (hasField(body, "sequence")) patch.sequence = Math.max(1, Number(body.sequence) || 1);
  const chapterId = patchNullableUuid(body, "chapterId");
  if (chapterId !== undefined) patch.chapterId = chapterId;
  const sceneId = patchNullableUuid(body, "sceneId");
  if (sceneId !== undefined) patch.sceneId = sceneId;
  if (hasField(body, "participantRoleIds")) {
    patch.participantRoleIds = Array.isArray(body.participantRoleIds) ? body.participantRoleIds.filter(Boolean) : [];
  }
  const alibiNotes = patchString(body, "alibiNotes");
  if (alibiNotes !== undefined) patch.alibiNotes = alibiNotes;
  if (hasField(body, "metadata")) {
    patch.metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  }
  return patch;
}

export const MATERIAL_BOOKLET_KINDS = ["diary", "catalog", "manual", "prop_book", "other"];
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

export function normalizeMaterialBookletPatch(body = {}) {
  const patch = {};
  if (hasField(body, "kind") && MATERIAL_BOOKLET_KINDS.includes(body.kind)) patch.kind = body.kind;
  const title = patchString(body, "title");
  if (title !== undefined) patch.title = title.slice(0, 200);
  const summary = patchString(body, "summary");
  if (summary !== undefined) patch.summary = summary.slice(0, 4000);
  const ownerRoleSlotId = patchNullableUuid(body, "ownerRoleSlotId");
  if (ownerRoleSlotId !== undefined) patch.ownerRoleSlotId = ownerRoleSlotId;
  const phaseLabel = patchString(body, "phaseLabel");
  if (phaseLabel !== undefined) patch.phaseLabel = phaseLabel.slice(0, 80);
  const chapterId = patchNullableUuid(body, "chapterId");
  if (chapterId !== undefined) patch.chapterId = chapterId;
  if (hasField(body, "visibility") && MATERIAL_BOOKLET_VISIBILITIES.includes(body.visibility)) {
    patch.visibility = body.visibility;
  }
  if (hasField(body, "pages")) patch.pages = normalizeMaterialPages(body.pages);
  if (hasField(body, "linkedClueIds")) patch.linkedClueIds = normalizeUuidList(body.linkedClueIds);
  if (hasField(body, "linkedRoleSlotIds")) patch.linkedRoleSlotIds = normalizeUuidList(body.linkedRoleSlotIds);
  if (hasField(body, "sequence")) patch.sequence = Math.max(1, Number(body.sequence) || 1);
  if (hasField(body, "metadata")) {
    patch.metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  }
  return patch;
}
