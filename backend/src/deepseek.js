import { throwErr } from "./api-errors.js";
import { buildStorySpecMessages } from "./prompts/spec.js";
import { buildStoryOutlineMessages } from "./prompts/outline.js";
import { buildStructureMessages } from "./prompts/structure.js";
import { buildRoleMatrixMessages } from "./prompts/role-matrix.js";
import { buildRoleSectionMessages } from "./prompts/section.js";
import { buildManuscriptSynopsisMessages } from "./prompts/manuscript-synopsis.js";
import { buildStoryEvaluationMessages } from "./prompts/evaluate.js";
import { buildChapterNarrativeMessages } from "./prompts/chapter-narrative.js";
import { buildRolesFromNarrativeMessages } from "./prompts/roles-from-narrative.js";
import { buildExtractStructureFromNarrativeMessages } from "./prompts/extract-structure-from-narrative.js";
import { clampInteger, cleanText } from "./prompts/shared.js";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const MIN_WORD_COUNT = 500;
const MAX_WORD_COUNT = 20000;
const MIN_PLAYERS = 4;
const MAX_PLAYERS = 8;

export function deepseekConfig() {
  return {
    configured: Boolean(process.env.DEEPSEEK_API_KEY),
    baseUrl: (process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
    model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
    timeoutMs: clampInteger(process.env.DEEPSEEK_TIMEOUT_MS, 5000, 180000, 120000)
  };
}

export function normalizeStoryBrief(input = {}) {
  const playerCount = clampInteger(input.playerCount, MIN_PLAYERS, MAX_PLAYERS, 6);
  const chapterCount = clampInteger(input.chapterCount, 1, 12, 3);
  const wordsPerChapter = clampInteger(
    input.wordsPerChapter,
    400,
    2500,
    clampInteger(input.targetWordCount, MIN_WORD_COUNT, MAX_WORD_COUNT, chapterCount * 800) / Math.max(chapterCount, 1)
  );
  const conflicts = cleanText(input.conflicts || input.requirements, 3000);
  return {
    title: cleanText(input.title, 120) || "未命名剧本杀",
    premise: cleanText(input.premise, 4000),
    conflicts,
    wordsPerChapter,
    style: cleanText(input.style, 800) || "悬疑调查，信息逐步揭示，适合线上长线剧本杀",
    audience: cleanText(input.audience, 400) || "线上剧本杀玩家",
    requirements: conflicts,
    roleRequirements: cleanText(input.roleRequirements, 3000),
    evaluationFocus: cleanText(input.evaluationFocus, 3000),
    existingManuscript: cleanText(input.existingManuscript, 12000),
    playerCount,
    targetWordCount: clampInteger(input.targetWordCount, MIN_WORD_COUNT, MAX_WORD_COUNT, chapterCount * wordsPerChapter),
    chapterCount,
    sceneCount: clampInteger(input.sceneCount, 1, 40, Math.max(chapterCount * 2, 6)),
    investigationPointCount: clampInteger(input.investigationPointCount, 1, 80, Math.max(chapterCount * 3, 8)),
    clueCount: clampInteger(input.clueCount, 1, 80, Math.max(chapterCount * 3, 8))
  };
}

function assertArray(value, name) {
  if (!Array.isArray(value)) throwErr("UPSTREAM_ERROR", `DeepSeek ${name} must be an array`);
  return value;
}

function uniqueKeys(items, name) {
  const keys = new Set();
  for (const item of items) {
    if (!item?.key || typeof item.key !== "string") throwErr("UPSTREAM_ERROR", `DeepSeek ${name} item requires key`);
    if (keys.has(item.key)) throwErr("UPSTREAM_ERROR", `DeepSeek ${name} contains duplicate key: ${item.key}`);
    keys.add(item.key);
  }
  return keys;
}

export function validateStorySpec(raw, brief) {
  const value = raw && typeof raw === "object" ? raw : {};
  const playerCount = clampInteger(value.playerCount, MIN_PLAYERS, MAX_PLAYERS, brief.playerCount);
  const chapterCount = clampInteger(value.chapterCount, 1, 12, brief.chapterCount);
  const chapterKeys = assertArray(value.chapterKeys ?? [], "chapterKeys").slice(0, 12).map((key, index) => cleanText(key, 40) || `chapter-${index + 1}`);
  while (chapterKeys.length < chapterCount) chapterKeys.push(`chapter-${chapterKeys.length + 1}`);
  return {
    title: cleanText(value.title, 120) || brief.title,
    playerCount,
    chapterCount: chapterKeys.length,
    chapterKeys: chapterKeys.slice(0, chapterCount),
    targetWordCount: clampInteger(value.targetWordCount, MIN_WORD_COUNT, MAX_WORD_COUNT, brief.targetWordCount),
    wordsPerSectionMin: clampInteger(value.wordsPerSectionMin, 150, 800, 250),
    sceneCount: clampInteger(value.sceneCount, 1, 40, brief.sceneCount),
    investigationPointCount: clampInteger(value.investigationPointCount, 1, 80, brief.investigationPointCount),
    clueCount: clampInteger(value.clueCount, 1, 80, brief.clueCount),
    constraints: assertArray(value.constraints ?? [], "constraints").slice(0, 12).map((item) => cleanText(item, 300)),
    notes: assertArray(value.notes ?? [], "notes").slice(0, 12).map((item) => cleanText(item, 500))
  };
}

export function validateStoryOutline(raw, spec) {
  const value = raw && typeof raw === "object" ? raw : {};
  const chapterKeys = new Set(spec.chapterKeys);
  const beats = assertArray(value.chapterBeats ?? [], "chapterBeats").slice(0, 12).map((beat, index) => ({
    chapterKey: chapterKeys.has(beat.chapterKey) ? beat.chapterKey : spec.chapterKeys[index] || `chapter-${index + 1}`,
    title: cleanText(beat.title, 120) || `第 ${index + 1} 章`,
    goal: cleanText(beat.goal, 600),
    turn: cleanText(beat.turn, 600),
    hostNotes: cleanText(beat.hostNotes, 800)
  }));
  if (!beats.length) throwErr("UPSTREAM_ERROR", "DeepSeek outline requires chapterBeats");
  return {
    logline: cleanText(value.logline, 600),
    truthTimeline: cleanText(value.truthTimeline, 4000),
    redHerrings: assertArray(value.redHerrings ?? [], "redHerrings").slice(0, 10).map((item) => cleanText(item, 400)),
    chapterBeats: beats,
    suggestions: assertArray(value.suggestions ?? [], "suggestions").slice(0, 12).map((item) => cleanText(item, 500))
  };
}

export function validateDeepseekProposal(raw) {
  const proposal = raw && typeof raw === "object" ? raw : {};
  const chapters = assertArray(proposal.chapters, "chapters").slice(0, 12);
  const scenes = assertArray(proposal.scenes, "scenes").slice(0, 40);
  const points = assertArray(proposal.investigationPoints, "investigationPoints").slice(0, 80);
  const clues = assertArray(proposal.clues, "clues").slice(0, 80);
  const edges = assertArray(proposal.edges, "edges").slice(0, 160);
  if (!chapters.length || !scenes.length) throwErr("UPSTREAM_ERROR", "DeepSeek proposal requires at least one chapter and one scene");
  const keys = {
    chapter: uniqueKeys(chapters, "chapters"),
    scene: uniqueKeys(scenes, "scenes"),
    investigation_point: uniqueKeys(points, "investigationPoints"),
    clue: uniqueKeys(clues, "clues")
  };
  for (const scene of scenes) if (!keys.chapter.has(scene.chapterKey)) throwErr("UPSTREAM_ERROR", `Scene references missing chapter: ${scene.chapterKey}`);
  for (const point of points) {
    if (!keys.scene.has(point.sceneKey)) throwErr("UPSTREAM_ERROR", `Investigation point references missing scene: ${point.sceneKey}`);
    if (point.clueKey && !keys.clue.has(point.clueKey)) throwErr("UPSTREAM_ERROR", `Investigation point references missing clue: ${point.clueKey}`);
  }
  for (const edge of edges) {
    if (!keys[edge.fromType]?.has(edge.fromKey) || !keys[edge.toType]?.has(edge.toKey)) throwErr("UPSTREAM_ERROR", "Story edge references missing node");
    if (!["mainline", "parallel", "extension"].includes(edge.relationType)) throwErr("RELATION_TYPE_INVALID", `Unsupported edge relation: ${edge.relationType}`);
  }
  return {
    title: cleanText(proposal.title, 160),
    logline: cleanText(proposal.logline, 600),
    writingPlan: proposal.writingPlan && typeof proposal.writingPlan === "object" ? proposal.writingPlan : {},
    chapters, scenes, investigationPoints: points, clues, edges,
    suggestions: assertArray(proposal.suggestions ?? [], "suggestions").slice(0, 20).map((item) => cleanText(item, 500))
  };
}

export function validateRoleMatrix(raw, spec, proposal) {
  const value = raw && typeof raw === "object" ? raw : {};
  const roles = assertArray(value.roles, "roles").slice(0, MAX_PLAYERS);
  if (roles.length !== spec.playerCount) throwErr("UPSTREAM_ERROR", `DeepSeek role matrix requires exactly ${spec.playerCount} roles`);
  const chapterKeys = new Set(proposal.chapters.map((chapter) => chapter.key));
  const roleKeys = new Set();
  for (const role of roles) {
    if (!role?.key || roleKeys.has(role.key)) throwErr("UPSTREAM_ERROR", "Role matrix keys must be unique");
    roleKeys.add(role.key);
    role.name = cleanText(role.name, 80);
    role.publicProfile = cleanText(role.publicProfile, 800);
    role.privateProfile = cleanText(role.privateProfile, 2000);
    role.chapterKnowledge = assertArray(role.chapterKnowledge ?? [], `roles.${role.key}.chapterKnowledge`).slice(0, 12).map((row) => ({
      chapterKey: chapterKeys.has(row.chapterKey) ? row.chapterKey : proposal.chapters[0]?.key,
      knows: cleanText(row.knows, 800),
      mustHide: cleanText(row.mustHide, 800),
      canDiscuss: cleanText(row.canDiscuss, 800)
    }));
    if (!role.name) throwErr("UPSTREAM_ERROR", `Role ${role.key} requires name`);
  }
  return {
    roles,
    crossChecks: assertArray(value.crossChecks ?? [], "crossChecks").slice(0, 16).map((item) => ({
      conclusion: cleanText(item.conclusion, 400),
      sources: assertArray(item.sources ?? [], "crossChecks.sources").slice(0, 6).map((source) => cleanText(source, 40))
    })),
    suggestions: assertArray(value.suggestions ?? [], "suggestions").slice(0, 12).map((item) => cleanText(item, 500))
  };
}

export function validateRoleSection(raw, roleKey, chapterKey, minWords = 250) {
  const value = raw && typeof raw === "object" ? raw : {};
  if (value.roleKey !== roleKey || value.chapterKey !== chapterKey) throwErr("UPSTREAM_ERROR", "Section roleKey/chapterKey mismatch");
  const body = cleanText(value.body, 6000);
  if (body.length < minWords) throwErr("UPSTREAM_ERROR", `Section body requires at least ${minWords} characters`);
  return {
    roleKey,
    chapterKey,
    title: cleanText(value.title, 160) || `${chapterKey} · 私人分幕`,
    body
  };
}

const MIN_CHAPTER_NARRATIVE_CHARS = 400;

export function validateChapterNarrative(raw, spec, chapterKey) {
  const value = raw && typeof raw === "object" ? raw : {};
  const key = cleanText(value.chapterKey || chapterKey, 40);
  if (!spec.chapterKeys.includes(key)) throwErr("UPSTREAM_ERROR", `Chapter narrative key must be one of: ${spec.chapterKeys.join(", ")}`);
  const narrativeBody = cleanText(value.narrativeBody, 8000);
  if (narrativeBody.length < MIN_CHAPTER_NARRATIVE_CHARS) {
    throwErr("UPSTREAM_ERROR", `Chapter narrative requires at least ${MIN_CHAPTER_NARRATIVE_CHARS} characters`);
  }
  return {
    chapterKey: key,
    title: cleanText(value.title, 120) || key,
    summary: cleanText(value.summary, 600),
    narrativeBody,
    hostNotes: cleanText(value.hostNotes, 2000),
    openThreads: Array.isArray(value.openThreads) ? value.openThreads.slice(0, 8).map((item) => cleanText(item, 300)) : [],
    resolvedThreads: Array.isArray(value.resolvedThreads) ? value.resolvedThreads.slice(0, 8).map((item) => cleanText(item, 300)) : [],
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.slice(0, 8).map((item) => cleanText(item, 500)) : []
  };
}

export function validateRolesFromNarrative(raw, spec, roleMatrix) {
  const value = raw && typeof raw === "object" ? raw : {};
  const sectionsRaw = Array.isArray(value.sections) ? value.sections : [];
  const roleKeys = new Set(roleMatrix.roles.map((r) => r.key));
  const chapterKeys = new Set(spec.chapterKeys);
  const sections = {};
  for (const item of sectionsRaw) {
    const roleKey = cleanText(item?.roleKey, 40);
    const chapterKey = cleanText(item?.chapterKey, 40);
    if (!roleKeys.has(roleKey) || !chapterKeys.has(chapterKey)) continue;
    sections[roleKey] = sections[roleKey] || {};
    sections[roleKey][chapterKey] = validateRoleSection(
      { roleKey, chapterKey, title: item.title, body: item.body },
      roleKey,
      chapterKey,
      spec.wordsPerSectionMin || 250
    );
  }
  const expected = spec.playerCount * spec.chapterKeys.length;
  const actual = Object.values(sections).reduce((n, ch) => n + Object.keys(ch).length, 0);
  if (actual < expected) throwErr("UPSTREAM_ERROR", `Expected ${expected} role sections, got ${actual}`);
  return {
    sections,
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.slice(0, 12).map((item) => cleanText(item, 500)) : []
  };
}

export async function createDeepseekChapterNarrative(input) {
  const brief = mergeBrief(input);
  const spec = validateStorySpec(input.spec, brief);
  const chapterKey = cleanText(input.chapterKey, 40);
  const chapterIndex = spec.chapterKeys.indexOf(chapterKey);
  if (chapterIndex < 0) throwErr("VALIDATION_ERROR", "chapterKey must exist in spec.chapterKeys");
  const previousChapters = Array.isArray(input.previousChapters) ? input.previousChapters : [];
  if (previousChapters.length !== chapterIndex) {
    throwErr("VALIDATION_ERROR", `previousChapters length must be ${chapterIndex} before chapter ${chapterKey}`);
  }
  const result = await requestDeepseekJson(
    buildChapterNarrativeMessages({
      brief,
      spec,
      chapterKey,
      chapterIndex,
      chapterCount: spec.chapterKeys.length,
      previousChapters
    }),
    { maxTokens: 6000, temperature: 0.5 }
  );
  return {
    provider: "deepseek",
    model: result.model,
    brief,
    spec,
    chapter: validateChapterNarrative(result.value, spec, chapterKey)
  };
}

export async function createDeepseekRolesFromNarrative(input) {
  const brief = mergeBrief(input);
  const spec = validateStorySpec(input.spec, brief);
  const roleMatrix = validateRoleMatrix(input.roleMatrix, spec, input.proposal || { chapters: spec.chapterKeys.map((key, i) => ({ key, title: `第 ${i + 1} 章`, summary: "", sequence: i + 1 })) });
  const chapters = Array.isArray(input.chapters) ? input.chapters.map((ch) => validateChapterNarrative(ch, spec, ch.chapterKey)) : [];
  if (chapters.length !== spec.chapterKeys.length) throwErr("VALIDATION_ERROR", "All chapter narratives required before role split");
  const result = await requestDeepseekJson(
    buildRolesFromNarrativeMessages({ brief, spec, roleMatrix, chapters }),
    { maxTokens: 12000, temperature: 0.45 }
  );
  const parsed = validateRolesFromNarrative(result.value, spec, roleMatrix);
  return { provider: "deepseek", model: result.model, brief, spec, roleMatrix, sections: parsed.sections, suggestions: parsed.suggestions };
}

export async function createDeepseekStructureFromNarrative(input) {
  const brief = mergeBrief(input);
  const spec = validateStorySpec(input.spec, brief);
  const chapters = Array.isArray(input.chapters) ? input.chapters.map((ch) => validateChapterNarrative(ch, spec, ch.chapterKey)) : [];
  if (!chapters.length) throwErr("VALIDATION_ERROR", "chapters required for structure extraction");
  const sectionsSample = Array.isArray(input.sectionsSample) ? input.sectionsSample : [];
  const result = await requestDeepseekJson(
    buildExtractStructureFromNarrativeMessages({ brief, spec, chapters, sectionsSample }),
    { maxTokens: 8000, temperature: 0.35 }
  );
  return {
    provider: "deepseek",
    model: result.model,
    brief,
    spec,
    proposal: validateDeepseekProposal(result.value)
  };
}

export function validateManuscriptSynopsis(raw, proposal) {
  const value = raw && typeof raw === "object" ? raw : {};
  const overallManuscript = cleanText(value.overallManuscript, 8000);
  if (overallManuscript.length < 400) throwErr("UPSTREAM_ERROR", "Manuscript synopsis too short");
  return {
    title: cleanText(value.title, 160) || proposal.title,
    summary: cleanText(value.summary, 1200) || proposal.logline,
    overallManuscript,
    logicNotes: assertArray(value.logicNotes ?? [], "logicNotes").slice(0, 12).map((item) => cleanText(item, 800))
  };
}

export async function requestDeepseekJson(messages, { maxTokens = 8000, temperature = 0.5 } = {}) {
  const config = deepseekConfig();
  if (!config.configured) throwErr("DEEPSEEK_NOT_CONFIGURED");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages,
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        temperature,
        max_tokens: maxTokens
      }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throwErr("UPSTREAM_ERROR", payload.error?.message || `DeepSeek API request failed with ${response.status}`);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throwErr("UPSTREAM_ERROR", "DeepSeek API returned an empty response");
    return { model: config.model, value: JSON.parse(content) };
  } catch (error) {
    if (error.name === "AbortError") throwErr("GATEWAY_TIMEOUT", "DeepSeek API 请求超时，请稍后重试。");
    if (error instanceof SyntaxError) throwErr("UPSTREAM_ERROR", "DeepSeek API 返回了无法解析的 JSON，请重试。");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function mergeBrief(input = {}) {
  const brief = normalizeStoryBrief(input);
  if (input.spec?.chapterCount) brief.chapterCount = input.spec.chapterCount;
  if (input.spec?.sceneCount) brief.sceneCount = input.spec.sceneCount;
  if (input.spec?.investigationPointCount) brief.investigationPointCount = input.spec.investigationPointCount;
  if (input.spec?.clueCount) brief.clueCount = input.spec.clueCount;
  if (input.spec?.targetWordCount) brief.targetWordCount = input.spec.targetWordCount;
  if (input.spec?.playerCount) brief.playerCount = input.spec.playerCount;
  return brief;
}

export async function createDeepseekStorySpec(input) {
  const brief = normalizeStoryBrief(input);
  const result = await requestDeepseekJson(buildStorySpecMessages(brief), { maxTokens: 2000, temperature: 0.3 });
  return { provider: "deepseek", model: result.model, brief, spec: validateStorySpec(result.value, brief) };
}

export async function createDeepseekStoryOutline(input) {
  const brief = mergeBrief(input);
  const spec = input.spec ? validateStorySpec(input.spec, brief) : (await createDeepseekStorySpec(brief)).spec;
  const result = await requestDeepseekJson(buildStoryOutlineMessages(brief, spec), { maxTokens: 4000, temperature: 0.45 });
  return { provider: "deepseek", model: result.model, brief, spec, outline: validateStoryOutline(result.value, spec) };
}

export function buildDeepseekStoryMessages(input) {
  const brief = mergeBrief(input);
  const spec = input.spec || {
    playerCount: brief.playerCount,
    chapterCount: brief.chapterCount,
    chapterKeys: Array.from({ length: brief.chapterCount }, (_, index) => `chapter-${index + 1}`),
    sceneCount: brief.sceneCount,
    investigationPointCount: brief.investigationPointCount,
    clueCount: brief.clueCount,
    targetWordCount: brief.targetWordCount
  };
  return {
    brief,
    messages: buildStructureMessages(brief, spec, input.outline || null)
  };
}

export async function createDeepseekStoryProposal(input) {
  const brief = mergeBrief(input);
  const spec = input.spec ? validateStorySpec(input.spec, brief) : null;
  const outline = input.outline ? validateStoryOutline(input.outline, spec || { chapterKeys: [] }) : null;
  const resolvedSpec = spec || (await createDeepseekStorySpec(brief)).spec;
  const resolvedOutline = outline || (input.skipOutline ? null : null);
  const { messages } = buildDeepseekStoryMessages({ ...input, brief, spec: resolvedSpec, outline: resolvedOutline });
  const result = await requestDeepseekJson(messages, { maxTokens: 10000, temperature: 0.55 });
  return {
    provider: "deepseek",
    model: result.model,
    brief,
    spec: resolvedSpec,
    outline: resolvedOutline,
    proposal: validateDeepseekProposal(result.value)
  };
}

export async function createDeepseekRoleMatrix(input) {
  const brief = mergeBrief(input);
  const spec = validateStorySpec(input.spec, brief);
  const outline = input.outline ? validateStoryOutline(input.outline, spec) : null;
  const proposal = validateDeepseekProposal(input.proposal);
  const result = await requestDeepseekJson(buildRoleMatrixMessages(brief, spec, outline, proposal), { maxTokens: 6000, temperature: 0.5 });
  return {
    provider: "deepseek",
    model: result.model,
    brief,
    spec,
    outline,
    proposal,
    roleMatrix: validateRoleMatrix(result.value, spec, proposal)
  };
}

export async function createDeepseekRoleSection(input) {
  const brief = mergeBrief(input);
  const spec = validateStorySpec(input.spec, brief);
  const outline = input.outline ? validateStoryOutline(input.outline, spec) : null;
  const proposal = validateDeepseekProposal(input.proposal);
  const roleMatrix = validateRoleMatrix(input.roleMatrix, spec, proposal);
  const roleKey = cleanText(input.roleKey, 40);
  const chapterKey = cleanText(input.chapterKey, 40);
  if (!roleKey || !chapterKey) throwErr("VALIDATION_ERROR", "roleKey and chapterKey are required");
  const minWords = spec.wordsPerSectionMin || 250;
  const result = await requestDeepseekJson(
    buildRoleSectionMessages({ brief, spec, outline, proposal, roleMatrix, roleKey, chapterKey, sectionMinWords: minWords }),
    { maxTokens: 3500, temperature: 0.65 }
  );
  return {
    provider: "deepseek",
    model: result.model,
    section: validateRoleSection(result.value, roleKey, chapterKey, minWords)
  };
}

export async function createDeepseekManuscriptSynopsis(input) {
  const brief = mergeBrief(input);
  const proposal = validateDeepseekProposal(input.proposal);
  const roleMatrix = input.roleMatrix ? validateRoleMatrix(input.roleMatrix, validateStorySpec(input.spec, brief), proposal) : null;
  const outline = input.outline ? validateStoryOutline(input.outline, validateStorySpec(input.spec, brief)) : null;
  const result = await requestDeepseekJson(
    buildManuscriptSynopsisMessages(brief, outline, proposal, roleMatrix),
    { maxTokens: 3000, temperature: 0.5 }
  );
  return {
    provider: "deepseek",
    model: result.model,
    synopsis: validateManuscriptSynopsis(result.value, proposal)
  };
}

/** @deprecated Prefer staged pipeline; runs sequential API calls without parallel long outputs */
export async function createDeepseekMysteryPackage(input) {
  const brief = mergeBrief(input);
  const specResult = await createDeepseekStorySpec(brief);
  const outlineResult = await createDeepseekStoryOutline({ ...input, spec: specResult.spec });
  const structureResult = await createDeepseekStoryProposal({
    ...input,
    spec: specResult.spec,
    outline: outlineResult.outline,
    skipOutline: true
  });
  const matrixResult = await createDeepseekRoleMatrix({
    ...input,
    spec: specResult.spec,
    outline: outlineResult.outline,
    proposal: structureResult.proposal
  });
  const sections = {};
  for (const role of matrixResult.roleMatrix.roles) {
    sections[role.key] = {};
    for (const chapter of structureResult.proposal.chapters) {
      const sectionResult = await createDeepseekRoleSection({
        ...input,
        spec: specResult.spec,
        outline: outlineResult.outline,
        proposal: structureResult.proposal,
        roleMatrix: matrixResult.roleMatrix,
        roleKey: role.key,
        chapterKey: chapter.key
      });
      sections[role.key][chapter.key] = sectionResult.section;
    }
  }
  const synopsisResult = await createDeepseekManuscriptSynopsis({
    ...input,
    spec: specResult.spec,
    outline: outlineResult.outline,
    proposal: structureResult.proposal,
    roleMatrix: matrixResult.roleMatrix
  });
  const packageRoles = matrixResult.roleMatrix.roles.map((role) => ({
    key: role.key,
    name: role.name,
    publicProfile: role.publicProfile,
    privateProfile: role.privateProfile,
    sections: structureResult.proposal.chapters.map((chapter) => {
      const section = sections[role.key][chapter.key];
      return { chapterKey: chapter.key, title: section.title, body: section.body };
    })
  }));
  return {
    provider: "deepseek",
    model: structureResult.model,
    brief,
    spec: specResult.spec,
    outline: outlineResult.outline,
    proposal: structureResult.proposal,
    roleMatrix: matrixResult.roleMatrix,
    package: {
      title: synopsisResult.synopsis.title,
      summary: synopsisResult.synopsis.summary,
      overallManuscript: synopsisResult.synopsis.overallManuscript,
      logicNotes: synopsisResult.synopsis.logicNotes,
      roles: packageRoles
    },
    pipelineMeta: {
      apiCalls: 4 + matrixResult.roleMatrix.roles.length * structureResult.proposal.chapters.length + 1,
      staged: true
    }
  };
}

export function validateStoryEvaluation(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const scores = value.scores && typeof value.scores === "object" ? value.scores : {};
  const clampScore = (key, fallback = 7) => clampInteger(Number(scores[key]) * 10, 10, 100, fallback * 10) / 10;
  const normalizedScores = {
    playability: clampScore("playability"),
    fairness: clampScore("fairness"),
    multiRoleDesign: clampScore("multiRoleDesign"),
    pacing: clampScore("pacing"),
    graphReady: clampScore("graphReady"),
    consistency: clampScore("consistency"),
    styleFit: clampScore("styleFit")
  };
  const overall = clampInteger(Number(value.overallScore) * 10, 10, 100, 70) / 10;
  const validLayers = new Set(["brief", "spec", "outline", "narrative", "structure", "roleMatrix", "matrix", "section", "synopsis", "evaluate"]);
  const validPriority = new Set(["must_fix", "should_fix", "optional"]);
  const issues = Array.isArray(value.issues) ? value.issues.slice(0, 12).map((item) => ({
    severity: ["high", "medium", "low"].includes(item?.severity) ? item.severity : "medium",
    area: cleanText(item?.area, 80),
    detail: cleanText(item?.detail, 500)
  })) : [];
  const revisions = Array.isArray(value.revisions) ? value.revisions.slice(0, 16).map((item) => {
    let targetLayer = validLayers.has(item?.targetLayer) ? item.targetLayer : "structure";
    if (targetLayer === "roleMatrix") targetLayer = "matrix";
    if (targetLayer === "brief") targetLayer = "spec";
    return {
      targetLayer,
      targetKey: cleanText(item?.targetKey, 40) || null,
      priority: validPriority.has(item?.priority) ? item.priority : "should_fix",
      problem: cleanText(item?.problem, 400),
      direction: cleanText(item?.direction, 800),
      promptHint: cleanText(item?.promptHint, 500),
      preserve: cleanText(item?.preserve, 400)
    };
  }) : [];
  const priorityOrder = { must_fix: 0, should_fix: 1, optional: 2 };
  revisions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const styleRaw = value.styleAlignment && typeof value.styleAlignment === "object" ? value.styleAlignment : {};
  const styleAlignment = {
    matchLevel: ["high", "medium", "low"].includes(styleRaw.matchLevel) ? styleRaw.matchLevel : "medium",
    summary: cleanText(styleRaw.summary, 800),
    keepEmphasis: Array.isArray(styleRaw.keepEmphasis) ? styleRaw.keepEmphasis.slice(0, 6).map((item) => cleanText(item, 300)) : [],
    adjustEmphasis: Array.isArray(styleRaw.adjustEmphasis) ? styleRaw.adjustEmphasis.slice(0, 6).map((item) => cleanText(item, 300)) : []
  };
  const nextStepOrder = Array.isArray(value.nextStepOrder)
    ? value.nextStepOrder.map((layer) => (layer === "roleMatrix" ? "matrix" : layer === "brief" ? "spec" : layer)).filter((layer) => validLayers.has(layer)).slice(0, 6)
    : [...new Set(revisions.map((item) => item.targetLayer))].slice(0, 5);
  const hasMustFix = revisions.some((item) => item.priority === "must_fix");
  const hasHigh = issues.some((item) => item.severity === "high");
  return {
    overallScore: overall,
    verdict: cleanText(value.verdict, 600),
    scores: normalizedScores,
    styleAlignment,
    strengths: Array.isArray(value.strengths) ? value.strengths.slice(0, 8).map((item) => cleanText(item, 300)) : [],
    issues,
    revisions,
    nextStepOrder,
    recommendations: Array.isArray(value.recommendations) ? value.recommendations.slice(0, 10).map((item) => cleanText(item, 400)) : [],
    readyForImport: Boolean(value.readyForImport) && !hasMustFix && !hasHigh && overall >= 7
  };
}

export async function createDeepseekStoryEvaluation(pipeline) {
  const result = await requestDeepseekJson(buildStoryEvaluationMessages(pipeline), { maxTokens: 4500, temperature: 0.35 });
  return { provider: "deepseek", model: result.model, evaluation: validateStoryEvaluation(result.value) };
}
