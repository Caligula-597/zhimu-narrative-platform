/**
 * Canonical story-spine contract shared by the Creator UI and backend.
 *
 * A story spine is the authored synthesis layer between scattered project
 * inputs and production artefacts.  It deliberately keeps provenance and
 * author-confirmation state so AI assembly can never silently become canon.
 */

export const STORY_SPINE_VERSION = 1;
export const STORY_SPINE_PROMPT_VERSION = "story-spine-v1";
export const STORY_SPINE_STATUSES = Object.freeze([
  "author_confirmed",
  "ai_draft",
  "unresolved"
]);

export const STORY_SPINE_CORE_SECTIONS = Object.freeze([
  ["logline", "一句话故事"],
  ["overview", "整体故事"],
  ["openingState", "开场状态"],
  ["incitingIncident", "引爆事件"],
  ["centralConflict", "核心冲突"],
  ["playerPremise", "玩家为何必须参与"],
  ["mechanismLoop", "玩家反复执行的行动"],
  ["truthAndReversal", "真相与核心转折"]
]);

const CORE_SECTION_KEYS = new Set(STORY_SPINE_CORE_SECTIONS.map(([key]) => key));
const STATUS_SET = new Set(STORY_SPINE_STATUSES);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maxLength = 4000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function integer(value, fallback = 0, min = 0, max = 999_999_999) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function status(value, fallback = "ai_draft") {
  return STATUS_SET.has(value) ? value : fallback;
}

function sourceRefs(value) {
  const rows = Array.isArray(value) ? value : [];
  return [...new Set(rows.map((item) => text(item, 180)).filter(Boolean))].slice(0, 30);
}

function normalizeBlock(value, fallbackStatus = "ai_draft") {
  const source = typeof value === "string" ? { text: value } : record(value);
  return {
    text: text(source.text, 12_000),
    status: status(source.status, fallbackStatus),
    sourceRefs: sourceRefs(source.sourceRefs)
  };
}

function normalizeRoleFunction(value, index) {
  const source = record(value);
  return {
    roleId: text(source.roleId, 120) || `draft-role-${index + 1}`,
    roleName: text(source.roleName, 120) || `角色 ${index + 1}`,
    storyFunction: text(source.storyFunction, 2400),
    goal: text(source.goal, 2400),
    pressure: text(source.pressure, 2400),
    status: status(source.status),
    sourceRefs: sourceRefs(source.sourceRefs)
  };
}

function normalizeChapterBeat(value, index) {
  const source = record(value);
  return {
    chapterId: text(source.chapterId, 120) || `draft-chapter-${index + 1}`,
    sequence: integer(source.sequence, index + 1, 1, 99),
    title: text(source.title, 200) || `第 ${index + 1} 章`,
    cause: text(source.cause, 3000),
    playerAction: text(source.playerAction, 3000),
    turn: text(source.turn, 3000),
    consequence: text(source.consequence, 3000),
    status: status(source.status),
    sourceRefs: sourceRefs(source.sourceRefs)
  };
}

function normalizeEnding(value, index) {
  const source = record(value);
  return {
    key: text(source.key, 100) || `ending-${index + 1}`,
    title: text(source.title, 200) || `结局方向 ${index + 1}`,
    requirements: text(source.requirements, 3000),
    consequence: text(source.consequence, 3000),
    status: status(source.status),
    sourceRefs: sourceRefs(source.sourceRefs)
  };
}

function normalizeOpenQuestion(value, index) {
  const source = record(value);
  return {
    key: text(source.key, 100) || `question-${index + 1}`,
    question: text(source.question, 3000),
    whyItMatters: text(source.whyItMatters, 3000),
    sourceRefs: sourceRefs(source.sourceRefs)
  };
}

function normalizeAssumption(value, index) {
  const source = record(value);
  return {
    key: text(source.key, 100) || `assumption-${index + 1}`,
    text: text(source.text, 3000),
    impact: text(source.impact, 3000),
    sourceRefs: sourceRefs(source.sourceRefs)
  };
}

function normalizeProvenance(value) {
  const source = record(value);
  return {
    promptVersion: text(source.promptVersion, 80) || STORY_SPINE_PROMPT_VERSION,
    model: text(source.model, 160),
    generatedAt: text(source.generatedAt, 80),
    sourceRevision: source.sourceRevision == null
      ? null
      : integer(source.sourceRevision, 0, 0, Number.MAX_SAFE_INTEGER)
  };
}

export function normalizeStorySpine(value = {}) {
  const source = record(value);
  const normalized = {
    version: STORY_SPINE_VERSION,
    title: text(source.title, 200),
    roleFunctions: (Array.isArray(source.roleFunctions) ? source.roleFunctions : [])
      .slice(0, 12)
      .map(normalizeRoleFunction),
    chapterArc: (Array.isArray(source.chapterArc) ? source.chapterArc : [])
      .slice(0, 12)
      .map(normalizeChapterBeat)
      .sort((a, b) => a.sequence - b.sequence),
    endingDirections: (Array.isArray(source.endingDirections) ? source.endingDirections : [])
      .slice(0, 8)
      .map(normalizeEnding),
    unresolvedQuestions: (Array.isArray(source.unresolvedQuestions) ? source.unresolvedQuestions : [])
      .slice(0, 20)
      .map(normalizeOpenQuestion)
      .filter((item) => item.question),
    assumptions: (Array.isArray(source.assumptions) ? source.assumptions : [])
      .slice(0, 20)
      .map(normalizeAssumption)
      .filter((item) => item.text),
    provenance: normalizeProvenance(source.provenance)
  };

  for (const [key] of STORY_SPINE_CORE_SECTIONS) {
    normalized[key] = normalizeBlock(source[key]);
  }
  return normalized;
}

export function isStorySpineEmpty(value = {}) {
  const spine = normalizeStorySpine(value);
  return !STORY_SPINE_CORE_SECTIONS.some(([key]) => spine[key].text)
    && !spine.chapterArc.length
    && !spine.roleFunctions.length;
}

export function confirmStorySpineSection(value = {}, sectionKey = "") {
  const spine = normalizeStorySpine(value);
  if (!CORE_SECTION_KEYS.has(sectionKey) || !spine[sectionKey].text) return spine;
  return {
    ...spine,
    [sectionKey]: {
      ...spine[sectionKey],
      status: "author_confirmed"
    }
  };
}

export function preserveConfirmedStorySpineSections(candidateValue = {}, currentValue = {}) {
  const candidate = normalizeStorySpine(candidateValue);
  const current = normalizeStorySpine(currentValue);
  for (const [key] of STORY_SPINE_CORE_SECTIONS) {
    if (current[key].status === "author_confirmed" && current[key].text) {
      candidate[key] = current[key];
    }
  }
  return candidate;
}

export function storySpineDiff(currentValue = {}, candidateValue = {}) {
  const current = normalizeStorySpine(currentValue);
  const candidate = normalizeStorySpine(candidateValue);
  const changedSections = STORY_SPINE_CORE_SECTIONS
    .filter(([key]) => current[key].text !== candidate[key].text)
    .map(([key, label]) => ({ key, label }));
  return {
    changedSections,
    roleFunctionDelta: candidate.roleFunctions.length - current.roleFunctions.length,
    chapterDelta: candidate.chapterArc.length - current.chapterArc.length,
    endingDelta: candidate.endingDirections.length - current.endingDirections.length,
    unresolvedDelta: candidate.unresolvedQuestions.length - current.unresolvedQuestions.length
  };
}

export function storySpineCoverage(value = {}) {
  const spine = normalizeStorySpine(value);
  const coreFilled = STORY_SPINE_CORE_SECTIONS.filter(([key]) => spine[key].text).length;
  const total = STORY_SPINE_CORE_SECTIONS.length + 3;
  const filled = coreFilled
    + (spine.roleFunctions.length ? 1 : 0)
    + (spine.chapterArc.length ? 1 : 0)
    + (spine.endingDirections.length ? 1 : 0);
  return {
    filled,
    total,
    score: Math.round((filled / total) * 100),
    confirmed: STORY_SPINE_CORE_SECTIONS.filter(([key]) => spine[key].status === "author_confirmed").length,
    draft: STORY_SPINE_CORE_SECTIONS.filter(([key]) => spine[key].status === "ai_draft" && spine[key].text).length,
    unresolved: spine.unresolvedQuestions.length + spine.assumptions.length
  };
}
