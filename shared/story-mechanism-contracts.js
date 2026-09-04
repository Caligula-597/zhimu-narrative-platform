/**
 * 剧情机制生产合同（STORY_MECHANISM）
 *
 * 冻结原则：
 * - GAME_MECHANISM（M02–M06、M09）：runtime 主体冻结，只补 Placement/Intro/Outcome。
 * - STORY_MECHANISM（M01/M07/M08/M10/M11）：先做「剧情生产模板」，不做 runtime。
 *
 * StoryMechanismBlock ≠ AI 长文；它是 结构 + 槽位 + 绑定 + Beat。
 * 每个 STORY 机制生成前必须 READ ProjectStoryState → 生成 Block → WRITE BACK。
 */

export const STORY_MECHANISM_CONTRACT_VERSION = 1;

export const STORY_BLOCK_STATUSES = Object.freeze([
  "DRAFT",
  "USER_ACCEPTED",
  "USER_MODIFIED",
  "LOCKED",
]);

export const FAMILY_MECHANISM_ROLE = Object.freeze({
  M01: "STORY_MECHANISM",
  M02: "GAME_MECHANISM",
  M03: "GAME_MECHANISM",
  M04: "GAME_MECHANISM",
  M05: "GAME_MECHANISM",
  M06: "GAME_MECHANISM",
  M07: "STORY_MECHANISM",
  M08: "STORY_MECHANISM",
  M09: "GAME_MECHANISM",
  M10: "STORY_MECHANISM",
  M11: "STORY_MECHANISM",
});

export function mechanismRoleForFamily(familyId) {
  return FAMILY_MECHANISM_ROLE[String(familyId)] || null;
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanText(value, maximum = 2400) {
  return String(value ?? "").trim().slice(0, maximum);
}

function cleanId(value) {
  return cleanText(value, 120);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/** @returns {{ id: string, name: string } | null} */
export function normalizeCharacterRef(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const id = cleanId(value);
    return id ? { id, name: id } : null;
  }
  const src = record(value);
  const id = cleanId(src.id);
  if (!id) return null;
  return { id, name: cleanText(src.name, 80) || id };
}

export function normalizeStoryBeat(value = {}) {
  const src = record(value);
  return {
    id: cleanId(src.id) || `beat-${Math.random().toString(36).slice(2, 8)}`,
    stageKey: cleanText(src.stageKey, 80),
    summary: cleanText(src.summary, 800),
    involvedRoleKeys: asArray(src.involvedRoleKeys).map(String),
    clueIds: asArray(src.clueIds).map(String),
  };
}

export function normalizeStoryClueBinding(value = {}) {
  const src = record(value);
  return {
    slotKey: cleanText(src.slotKey, 80),
    clueId: cleanId(src.clueId),
    label: cleanText(src.label, 160),
    summary: cleanText(src.summary, 800),
    pointsToRoleKey: cleanText(src.pointsToRoleKey, 80) || null,
  };
}

export function normalizeStoryStageBinding(value = {}) {
  const src = record(value);
  return {
    patternKey: cleanText(src.patternKey, 80),
    stageId: cleanId(src.stageId) || null,
    stageLabel: cleanText(src.stageLabel, 120),
    order: Number.isFinite(Number(src.order)) ? Number(src.order) : 0,
  };
}

export function normalizeStoryFact(value = {}) {
  const src = record(value);
  return {
    id: cleanId(src.id),
    kind: cleanText(src.kind, 80),
    summary: cleanText(src.summary, 800),
    characterIds: asArray(src.characterIds).map(String),
    secret: Boolean(src.secret),
  };
}

export function normalizeEditableSlot(value = {}) {
  const src = record(value);
  return {
    key: cleanText(src.key || src.id, 80),
    id: cleanText(src.id || src.key, 80),
    kind: cleanText(src.kind, 40) || "plot", // role | plot | clue
    type: cleanText(src.type, 40) || (src.kind === "role" ? "CHARACTER" : "TEXT_OR_PRESET"),
    label: cleanText(src.label, 120),
    locked: Boolean(src.locked),
    actions: asArray(src.actions).map(String),
    source: cleanText(src.source, 40) || "SYSTEM", // SYSTEM | USER
  };
}

export function normalizeRoleAssignment(value = {}) {
  const src = record(value);
  return {
    mechanismBlockId: cleanId(src.mechanismBlockId),
    mechanismId: cleanId(src.mechanismId),
    slotId: cleanText(src.slotId, 80),
    characterId: cleanId(src.characterId),
    intensity: Number.isFinite(Number(src.intensity)) ? Number(src.intensity) : 1,
    intentionalOverlap: Boolean(src.intentionalOverlap),
    narrativeRole: cleanText(src.narrativeRole, 80),
  };
}

export function normalizeStoryMechanismBlock(value = {}) {
  const src = record(value);
  const status = STORY_BLOCK_STATUSES.includes(src.status) ? src.status : "DRAFT";
  const roleBindings = {};
  for (const [key, ref] of Object.entries(record(src.roleBindings))) {
    roleBindings[key] = normalizeCharacterRef(ref);
  }
  const lockedSlots = asArray(src.lockedSlots).map(String);
  const editableSlots = asArray(src.editableSlots).map(normalizeEditableSlot).map((slot) => ({
    ...slot,
    locked: slot.locked || lockedSlots.includes(slot.key),
  }));
  return {
    id: cleanId(src.id),
    mechanismId: cleanId(src.mechanismId),
    familyId: cleanId(src.familyId),
    templateId: cleanId(src.templateId),
    title: cleanText(src.title, 160),
    purpose: cleanText(src.purpose, 800),
    variantId: cleanId(src.variantId),
    revision: Number.isFinite(Number(src.revision)) ? Number(src.revision) : 1,
    roleBindings,
    plotBindings: { ...record(src.plotBindings) },
    slotSources: { ...record(src.slotSources) },
    clueBindings: asArray(src.clueBindings).map(normalizeStoryClueBinding),
    stageBindings: asArray(src.stageBindings).map(normalizeStoryStageBinding),
    setup: asArray(src.setup).map(normalizeStoryBeat),
    progression: asArray(src.progression).map(normalizeStoryBeat),
    climax: asArray(src.climax).map(normalizeStoryBeat),
    resolution: asArray(src.resolution).map(normalizeStoryBeat),
    prerequisites: asArray(src.prerequisites),
    consequences: asArray(src.consequences),
    exposedFacts: asArray(src.exposedFacts).map(normalizeStoryFact),
    reservedFacts: asArray(src.reservedFacts).map(normalizeStoryFact),
    editableSlots,
    lockedSlots,
    integrationHints: record(src.integrationHints),
    status,
  };
}

export function normalizeStoryCharacterState(value = {}) {
  const src = record(value);
  return {
    id: cleanId(src.id),
    name: cleanText(src.name, 80) || cleanId(src.id),
    isNpc: Boolean(src.isNpc),
    loadTags: asArray(src.loadTags).map(String),
    intentionalOverlaps: asArray(src.intentionalOverlaps).map(String),
  };
}

export function normalizeStoryStageState(value = {}) {
  const src = record(value);
  return {
    id: cleanId(src.id),
    label: cleanText(src.label, 120),
    order: Number.isFinite(Number(src.order)) ? Number(src.order) : 0,
  };
}

export function emptyAssignments() {
  return {
    killerCharacterIds: [],
    victimCharacterIds: [],
    framedCharacterIds: [],
    hiddenIdentityCharacterIds: [],
    factionLeaderCharacterIds: [],
    overloadedCharacterIds: [],
  };
}

/** 从 roleAssignments 重建兼容字段（M01 测试与旧读取路径）。 */
export function rebuildLegacyAssignments(roleAssignments = []) {
  const a = emptyAssignments();
  const loadCount = new Map();
  for (const row of roleAssignments) {
    const id = row.characterId;
    if (!id) continue;
    loadCount.set(id, (loadCount.get(id) || 0) + 1);
    const role = String(row.narrativeRole || row.slotId || "");
    if (role === "killer" || row.slotId === "culprit") {
      if (!a.killerCharacterIds.includes(id)) a.killerCharacterIds.push(id);
    }
    if (role === "victim" || row.slotId === "victim") {
      if (!a.victimCharacterIds.includes(id)) a.victimCharacterIds.push(id);
    }
    if (role === "framed" || row.slotId === "framedCharacter") {
      if (!a.framedCharacterIds.includes(id)) a.framedCharacterIds.push(id);
    }
    if (role === "identity_bearer" || row.slotId === "bearer") {
      if (!a.hiddenIdentityCharacterIds.includes(id)) a.hiddenIdentityCharacterIds.push(id);
    }
    if (role === "faction_lead" || String(row.slotId).startsWith("factionLead")) {
      if (!a.factionLeaderCharacterIds.includes(id)) a.factionLeaderCharacterIds.push(id);
    }
  }
  for (const [id, n] of loadCount) {
    if (n >= 2 && !a.overloadedCharacterIds.includes(id)) a.overloadedCharacterIds.push(id);
  }
  return a;
}

export function createProjectStoryState(input = {}) {
  const src = record(input);
  const premise = record(src.premise);
  let roleAssignments = asArray(src.roleAssignments).map(normalizeRoleAssignment);
  // 兼容：若只有 legacy assignments、无 roleAssignments，保留 legacy
  const legacyIn = record(src.assignments);
  const hasLegacy =
    asArray(legacyIn.killerCharacterIds).length ||
    asArray(legacyIn.victimCharacterIds).length ||
    asArray(legacyIn.framedCharacterIds).length;
  const assignments = roleAssignments.length
    ? rebuildLegacyAssignments(roleAssignments)
    : {
        ...emptyAssignments(),
        killerCharacterIds: asArray(legacyIn.killerCharacterIds).map(String),
        victimCharacterIds: asArray(legacyIn.victimCharacterIds).map(String),
        framedCharacterIds: asArray(legacyIn.framedCharacterIds).map(String),
        hiddenIdentityCharacterIds: asArray(legacyIn.hiddenIdentityCharacterIds).map(String),
        factionLeaderCharacterIds: asArray(legacyIn.factionLeaderCharacterIds).map(String),
        overloadedCharacterIds: asArray(legacyIn.overloadedCharacterIds).map(String),
      };
  if (!roleAssignments.length && hasLegacy) {
    // 不伪造 roleAssignments；仅保留兼容字段
  }
  return {
    version: STORY_MECHANISM_CONTRACT_VERSION,
    projectId: cleanId(src.projectId) || "project",
    premise: {
      genre: cleanText(premise.genre, 80) || undefined,
      era: cleanText(premise.era, 80) || undefined,
      tone: asArray(premise.tone).map(String),
      playerCount: Math.max(1, Math.trunc(Number(premise.playerCount) || 6)),
      targetDuration: premise.targetDuration != null
        ? Math.trunc(Number(premise.targetDuration) || 0)
        : undefined,
    },
    characters: asArray(src.characters).map(normalizeStoryCharacterState),
    stages: asArray(src.stages).map(normalizeStoryStageState),
    locations: asArray(src.locations),
    mechanismBlocks: asArray(src.mechanismBlocks).map(normalizeStoryMechanismBlock),
    roleAssignments,
    assignments,
    facts: asArray(src.facts).map(normalizeStoryFact),
    clues: asArray(src.clues),
    constraints: asArray(src.constraints),
    unresolvedNeeds: asArray(src.unresolvedNeeds),
    revision: Math.max(0, Math.trunc(Number(src.revision) || 0)),
    updatedAt: src.updatedAt != null ? String(src.updatedAt) : null,
  };
}

export function normalizeProjectStoryState(value = {}) {
  return createProjectStoryState(value);
}

/** 角色叙事负载：优先 roleAssignments，兼容 legacy assignments。 */
export function characterLoadScore(state, characterId) {
  const rows = asArray(state.roleAssignments).filter((r) => r.characterId === characterId);
  if (rows.length) {
    return rows.reduce((sum, r) => sum + (r.intentionalOverlap ? 0.5 : Number(r.intensity) || 1), 0);
  }
  const a = state.assignments || emptyAssignments();
  let score = 0;
  if (a.killerCharacterIds?.includes(characterId)) score += 3;
  if (a.victimCharacterIds?.includes(characterId)) score += 2;
  if (a.framedCharacterIds?.includes(characterId)) score += 2;
  if (a.hiddenIdentityCharacterIds?.includes(characterId)) score += 2;
  if (a.factionLeaderCharacterIds?.includes(characterId)) score += 1;
  if (a.overloadedCharacterIds?.includes(characterId)) score += 1;
  return score;
}

export function listCharacterNarrativeRoles(state, characterId) {
  return asArray(state.roleAssignments).filter((r) => r.characterId === characterId);
}

export function detectNarrativeOverload(state, { threshold = 3 } = {}) {
  const byChar = new Map();
  for (const row of asArray(state.roleAssignments)) {
    if (!row.characterId || row.intentionalOverlap) continue;
    byChar.set(row.characterId, (byChar.get(row.characterId) || 0) + (Number(row.intensity) || 1));
  }
  return [...byChar.entries()]
    .filter(([, score]) => score >= threshold)
    .map(([characterId, score]) => ({ characterId, score }));
}

export function listAvailableCharacters(state, { allowNpc = true, maxLoad = 1 } = {}) {
  return state.characters.filter((c) => {
    if (!allowNpc && c.isNpc) return false;
    return characterLoadScore(state, c.id) <= maxLoad;
  });
}

export function findBlock(state, blockId) {
  return state.mechanismBlocks.find((b) => b.id === blockId) || null;
}

export function replaceBlock(state, block) {
  const next = normalizeStoryMechanismBlock(block);
  const blocks = state.mechanismBlocks.map((b) => (b.id === next.id ? next : b));
  if (!blocks.some((b) => b.id === next.id)) blocks.push(next);
  return { ...state, mechanismBlocks: blocks };
}

export function removeBlockFromState(state, blockId) {
  const id = String(blockId);
  return {
    ...state,
    mechanismBlocks: state.mechanismBlocks.filter((b) => b.id !== id),
    roleAssignments: asArray(state.roleAssignments).filter((r) => r.mechanismBlockId !== id),
    facts: asArray(state.facts).filter((f) => !String(f.id).includes(id)),
    clues: asArray(state.clues).filter((c) => c.sourceBlockId !== id),
  };
}
