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
    key: cleanText(src.key, 80),
    kind: cleanText(src.kind, 40) || "plot", // role | plot | clue
    label: cleanText(src.label, 120),
    locked: Boolean(src.locked),
  };
}

export function normalizeStoryMechanismBlock(value = {}) {
  const src = record(value);
  const status = STORY_BLOCK_STATUSES.includes(src.status) ? src.status : "DRAFT";
  const roleBindings = {};
  for (const [key, ref] of Object.entries(record(src.roleBindings))) {
    roleBindings[key] = normalizeCharacterRef(ref);
  }
  return {
    id: cleanId(src.id),
    mechanismId: cleanId(src.mechanismId),
    familyId: cleanId(src.familyId),
    templateId: cleanId(src.templateId),
    title: cleanText(src.title, 160),
    purpose: cleanText(src.purpose, 800),
    variantId: cleanId(src.variantId),
    roleBindings,
    plotBindings: { ...record(src.plotBindings) },
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
    editableSlots: asArray(src.editableSlots).map(normalizeEditableSlot),
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

export function createProjectStoryState(input = {}) {
  const src = record(input);
  const premise = record(src.premise);
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
    assignments: {
      ...emptyAssignments(),
      ...record(src.assignments),
      killerCharacterIds: asArray(record(src.assignments).killerCharacterIds).map(String),
      victimCharacterIds: asArray(record(src.assignments).victimCharacterIds).map(String),
      framedCharacterIds: asArray(record(src.assignments).framedCharacterIds).map(String),
      hiddenIdentityCharacterIds: asArray(record(src.assignments).hiddenIdentityCharacterIds).map(String),
      factionLeaderCharacterIds: asArray(record(src.assignments).factionLeaderCharacterIds).map(String),
      overloadedCharacterIds: asArray(record(src.assignments).overloadedCharacterIds).map(String),
    },
    facts: asArray(src.facts).map(normalizeStoryFact),
    clues: asArray(src.clues),
    constraints: asArray(src.constraints),
    unresolvedNeeds: asArray(src.unresolvedNeeds),
  };
}

export function normalizeProjectStoryState(value = {}) {
  return createProjectStoryState(value);
}

/** 角色是否已被核心职责占用（除非 INTENTIONAL_OVERLAP）。 */
export function characterLoadScore(state, characterId) {
  const a = state.assignments;
  let score = 0;
  if (a.killerCharacterIds.includes(characterId)) score += 3;
  if (a.victimCharacterIds.includes(characterId)) score += 2;
  if (a.framedCharacterIds.includes(characterId)) score += 2;
  if (a.hiddenIdentityCharacterIds.includes(characterId)) score += 2;
  if (a.factionLeaderCharacterIds.includes(characterId)) score += 1;
  if (a.overloadedCharacterIds.includes(characterId)) score += 1;
  return score;
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
