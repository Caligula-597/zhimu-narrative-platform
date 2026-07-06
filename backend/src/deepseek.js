import { throwErr } from "./api-errors.js";
import { chargeAiCredits, isCreditsDebitAiEnabled, isCreditsSystemEnabled } from "./credits.js";
import { getLlmRuntime } from "./llm-runtime.js";
import { buildStorySpecMessages } from "./prompts/spec.js";
import { buildStoryOutlineMessages } from "./prompts/outline.js";
import { buildStructureMessages } from "./prompts/structure.js";
import { buildRoleMatrixMessages } from "./prompts/role-matrix.js";
import { buildRoleSectionMessages } from "./prompts/section.js";
import { buildManuscriptSynopsisMessages } from "./prompts/manuscript-synopsis.js";
import { buildStoryEvaluationMessages } from "./prompts/evaluate.js";
import { buildChapterNarrativeMessages, buildChapterNarrativeContinuationMessages } from "./prompts/chapter-narrative.js";
import { buildRolesFromNarrativeMessages } from "./prompts/roles-from-narrative.js";
import { buildExtractStructureFromNarrativeMessages } from "./prompts/extract-structure-from-narrative.js";
import { buildRolesMetaFromNarrativeMessages } from "./prompts/roles-meta-from-narrative.js";
import { buildRoleScriptFromNarrativeMessages } from "./prompts/role-script-from-narrative.js";
import { validateCreativeSetting, validateSynopsisInput } from "./prompts/creative-input.js";
import { clampInteger, cleanText } from "./prompts/shared.js";
import { pipelineWordTargets } from "./pipeline-matrix-model.js";

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
    timeoutMs: clampInteger(process.env.DEEPSEEK_TIMEOUT_MS, 5000, 240000, 180000)
  };
}

function chapterNarrativeCallTimeoutMs() {
  const base = deepseekConfig().timeoutMs;
  return Math.min(240000, Math.max(base, 180000));
}

function logChapterNarrative(chapterKey, phase, extra = {}) {
  console.info(JSON.stringify({ event: "deepseek.chapter_narrative", chapterKey, phase, ...extra }));
}

function enrichDeepseekError(error, details) {
  if (!error || typeof error !== "object") return error;
  error.details = { ...(error.details || {}), ...details };
  return error;
}

export function normalizeStoryBrief(input = {}) {
  const playerCount = clampInteger(input.playerCount, MIN_PLAYERS, MAX_PLAYERS, 6);
  const chapterCount = clampInteger(input.chapterCount, 1, 12, 3);
  const wordsPerChapter = clampInteger(
    input.wordsPerChapter,
    2000,
    12000,
    clampInteger(input.targetWordCount, MIN_WORD_COUNT, MAX_WORD_COUNT, chapterCount * 8000) / Math.max(chapterCount, 1)
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
  if (!Array.isArray(value)) throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 返回的 ${name} 不是数组`);
  return value;
}

function uniqueKeys(items, name) {
  const keys = new Set();
  for (const item of items) {
    if (!item?.key || typeof item.key !== "string") throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 返回的 ${name} 缺少 key 字段`);
    if (keys.has(item.key)) throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 返回的 ${name} 存在重复 key：${item.key}`);
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
  if (!beats.length) throwErr("DEEPSEEK_OUTPUT_INVALID", "AI 大纲缺少 chapterBeats");
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
  if (!chapters.length || !scenes.length) throwErr("DEEPSEEK_OUTPUT_INVALID", "AI 提案至少需包含一个章节与一个场景");
  const keys = {
    chapter: uniqueKeys(chapters, "chapters"),
    scene: uniqueKeys(scenes, "scenes"),
    investigation_point: uniqueKeys(points, "investigationPoints"),
    clue: uniqueKeys(clues, "clues")
  };
  for (const scene of scenes) if (!keys.chapter.has(scene.chapterKey)) throwErr("DEEPSEEK_OUTPUT_INVALID", `场景引用了不存在的章节：${scene.chapterKey}`);
  for (const point of points) {
    if (!keys.scene.has(point.sceneKey)) throwErr("DEEPSEEK_OUTPUT_INVALID", `调查点引用了不存在的场景：${point.sceneKey}`);
    if (point.clueKey && !keys.clue.has(point.clueKey)) throwErr("DEEPSEEK_OUTPUT_INVALID", `调查点引用了不存在的线索：${point.clueKey}`);
  }
  for (const edge of edges) {
    if (!keys[edge.fromType]?.has(edge.fromKey) || !keys[edge.toType]?.has(edge.toKey)) throwErr("DEEPSEEK_OUTPUT_INVALID", "剧情边引用了不存在的节点");
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
  if (roles.length !== spec.playerCount) throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 角色矩阵需恰好 ${spec.playerCount} 个角色，实际 ${roles.length} 个`);
  const chapterKeys = new Set(proposal.chapters.map((chapter) => chapter.key));
  const roleKeys = new Set();
  for (const role of roles) {
    if (!role?.key || roleKeys.has(role.key)) throwErr("DEEPSEEK_OUTPUT_INVALID", "角色矩阵 key 必须唯一");
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
    if (!role.name) throwErr("DEEPSEEK_OUTPUT_INVALID", `角色 ${role.key} 缺少 name`);
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
  if (value.roleKey !== roleKey || value.chapterKey !== chapterKey) throwErr("DEEPSEEK_OUTPUT_INVALID", "分幕 roleKey/chapterKey 与请求不一致");
  const body = cleanText(value.body, 6000);
  if (body.length < minWords) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", `分幕正文仅 ${body.length} 字，未达到最低 ${minWords} 字`, { actualChars: body.length, minChars: minWords, roleKey, chapterKey });
  }
  return {
    roleKey,
    chapterKey,
    title: cleanText(value.title, 160) || `${chapterKey} · 私人分幕`,
    body
  };
}

const MIN_CHAPTER_NARRATIVE_CHARS = 2000;

function chapterNarrativeMinChars(setting, config) {
  const target = setting?.wordsPerChapter || Math.floor((config?.targetWordCount || 8000) / Math.max(config?.chapterCount || 1, 1));
  return Math.max(MIN_CHAPTER_NARRATIVE_CHARS, Math.floor(target * 0.45));
}

function parseChapterNarrative(raw, spec, chapterKey) {
  const value = raw && typeof raw === "object" ? raw : {};
  const key = cleanText(value.chapterKey || chapterKey, 40);
  if (!spec.chapterKeys.includes(key)) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", `章节 key 必须是 ${spec.chapterKeys.join("、")} 之一，实际为 ${key}`, { chapterKey: key, expectedKeys: spec.chapterKeys });
  }
  const narrativeBody = cleanText(value.narrativeBody, 120000);
  if (!narrativeBody) throwErr("DEEPSEEK_OUTPUT_INVALID", "AI 返回的总剧情正文为空", { chapterKey: key });
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

export function validateChapterNarrative(raw, spec, chapterKey, minChars = MIN_CHAPTER_NARRATIVE_CHARS) {
  const chapter = raw?.narrativeBody && raw?.chapterKey ? raw : parseChapterNarrative(raw, spec, chapterKey);
  if (chapter.narrativeBody.length < minChars) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", `本章总剧情仅 ${chapter.narrativeBody.length} 字，未达到最低 ${minChars} 字要求`, {
      chapterKey: chapter.chapterKey,
      actualChars: chapter.narrativeBody.length,
      minChars
    });
  }
  return chapter;
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
  if (actual < expected) throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 仅返回 ${actual}/${expected} 个角色分幕`);
  return {
    sections,
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.slice(0, 12).map((item) => cleanText(item, 500)) : []
  };
}

export function validateRolesMeta(raw, playerCount) {
  const value = raw && typeof raw === "object" ? raw : {};
  const roles = assertArray(value.roles, "roles").slice(0, MAX_PLAYERS);
  if (roles.length !== playerCount) throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 返回 ${roles.length} 个角色，需要 ${playerCount} 个`);
  const keys = new Set();
  return {
    roles: roles.map((role, index) => {
      const key = cleanText(role?.key, 40) || `role-${index + 1}`;
      if (keys.has(key)) throwErr("DEEPSEEK_OUTPUT_INVALID", "角色 key 必须唯一");
      keys.add(key);
      return {
        key,
        name: cleanText(role.name, 80) || `角色 ${index + 1}`,
        publicProfile: cleanText(role.publicProfile, 800),
        privateProfile: cleanText(role.privateProfile, 2000)
      };
    }),
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.slice(0, 8).map((item) => cleanText(item, 500)) : []
  };
}

export function validateRoleScriptFromNarrative(raw, roleKey, spec, minWords, requiredChapterKeys = null) {
  const value = raw && typeof raw === "object" ? raw : {};
  const sectionsRaw = Array.isArray(value.sections) ? value.sections : [];
  const sections = {};
  sections[roleKey] = {};
  for (const item of sectionsRaw) {
    const rk = cleanText(item?.roleKey, 40);
    const ck = cleanText(item?.chapterKey, 40);
    if (rk !== roleKey || !spec.chapterKeys.includes(ck)) continue;
    sections[roleKey][ck] = validateRoleSection({ roleKey, chapterKey: ck, title: item.title, body: item.body }, roleKey, ck, minWords);
  }
  const keys = requiredChapterKeys || spec.chapterKeys;
  const missing = keys.filter((ck) => !sections[roleKey][ck]);
  if (missing.length) throwErr("DEEPSEEK_OUTPUT_INVALID", `角色 ${roleKey} 缺少分幕：${missing.join("、")}`, { roleKey, missing });
  return {
    roleKey,
    sections: sections[roleKey],
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.slice(0, 8).map((item) => cleanText(item, 500)) : []
  };
}

function roleScriptMaxTokens(minWords, sectionCount) {
  const perSection = Math.max(minWords, 800);
  const targetChars = sectionCount * perSection * 1.25;
  return Math.min(32768, Math.max(4096, Math.ceil(targetChars * 2.5) + 800));
}

function roleScriptCallTimeoutMs() {
  const base = deepseekConfig().timeoutMs;
  return Math.min(240000, Math.max(base, 180000));
}

function logRoleScript(roleKey, phase, extra = {}) {
  console.info(JSON.stringify({ event: "deepseek.role_script", roleKey, phase, ...extra }));
}

function chapterNarrativeTargetChars(setting, config) {
  return setting?.wordsPerChapter || Math.floor((config?.targetWordCount || 8000) / Math.max(config?.chapterCount || 1, 1));
}

/** 中文 narrativeBody 约 2～2.5 token/字；JSON 结构额外预留。 */
function chapterNarrativeMaxTokens(wordsPerChapter) {
  const target = wordsPerChapter || 8000;
  return Math.min(32768, Math.max(8192, Math.ceil(target * 2.5) + 1500));
}

function mergeChapterNarrativeContinuation(chapter, contRaw) {
  const cont = contRaw && typeof contRaw === "object" ? contRaw : {};
  const append = cleanText(cont.narrativeBodyContinuation || cont.narrativeBody, 80000);
  if (!append) return chapter;
  const hostAppend = cleanText(cont.hostNotesAppend, 2000);
  return {
    ...chapter,
    summary: cleanText(cont.summary, 600) || chapter.summary,
    narrativeBody: `${chapter.narrativeBody.trim()}\n\n${append.trim()}`,
    hostNotes: hostAppend ? `${chapter.hostNotes}\n${hostAppend}`.trim() : chapter.hostNotes,
    openThreads: [...chapter.openThreads, ...(Array.isArray(cont.openThreads) ? cont.openThreads : [])].slice(0, 8).map((item) => cleanText(item, 300)),
    resolvedThreads: [...chapter.resolvedThreads, ...(Array.isArray(cont.resolvedThreads) ? cont.resolvedThreads : [])].slice(0, 8).map((item) => cleanText(item, 300)),
    suggestions: [...chapter.suggestions, ...(Array.isArray(cont.suggestions) ? cont.suggestions : [])].slice(0, 8).map((item) => cleanText(item, 500))
  };
}

export async function createDeepseekChapterNarrative(input) {
  const started = Date.now();
  const { setting, synopsis, config, brief } = resolveCreativePipeline(input);
  const chapterKey = cleanText(input.chapterKey, 40);
  const chapterIndex = config.chapterKeys.indexOf(chapterKey);
  if (chapterIndex < 0) throwErr("VALIDATION_ERROR", "chapterKey must exist in config.chapterKeys");
  const previousChapters = Array.isArray(input.previousChapters) ? input.previousChapters : [];
  if (previousChapters.length !== chapterIndex) {
    throwErr("VALIDATION_ERROR", `previousChapters length must be ${chapterIndex} before chapter ${chapterKey}`);
  }
  const minChars = chapterNarrativeMinChars(setting, config);
  const targetChars = chapterNarrativeTargetChars(setting, config);
  const maxTokens = chapterNarrativeMaxTokens(targetChars);
  const callTimeoutMs = chapterNarrativeCallTimeoutMs();
  const ctx = { chapterKey, chapterIndex: chapterIndex + 1, priorCount: previousChapters.length, targetChars, minChars };

  logChapterNarrative(chapterKey, "start", { ...ctx, timeoutMs: callTimeoutMs });

  try {
    logChapterNarrative(chapterKey, "request_primary", { maxTokens });
    const result = await requestDeepseekJson(
      buildChapterNarrativeMessages({
        setting,
        synopsis,
        config,
        chapterKey,
        chapterIndex,
        chapterCount: config.chapterKeys.length,
        previousChapters
      }),
      { maxTokens, temperature: 0.5, timeoutMs: callTimeoutMs, phase: "primary", context: ctx }
    );
    let chapter = parseChapterNarrative(result.value, config, chapterKey);
    logChapterNarrative(chapterKey, "primary_done", { bodyChars: chapter.narrativeBody.length, elapsedMs: Date.now() - started });

    const needsContinuation = chapter.narrativeBody.length < targetChars * 0.85 && targetChars >= 5000;
    if (needsContinuation) {
      const remaining = Math.max(1500, targetChars - chapter.narrativeBody.length);
      logChapterNarrative(chapterKey, "request_continuation", { remaining, bodyChars: chapter.narrativeBody.length });
      const contResult = await requestDeepseekJson(
        buildChapterNarrativeContinuationMessages({
          setting,
          synopsis,
          config,
          chapterKey,
          chapterIndex,
          chapterCount: config.chapterKeys.length,
          previousChapters,
          partialChapter: chapter,
          remainingChars: remaining
        }),
        { maxTokens: chapterNarrativeMaxTokens(remaining), temperature: 0.5, timeoutMs: callTimeoutMs, phase: "continuation", context: ctx }
      );
      chapter = mergeChapterNarrativeContinuation(chapter, contResult.value);
      logChapterNarrative(chapterKey, "continuation_done", { bodyChars: chapter.narrativeBody.length, elapsedMs: Date.now() - started });
    }

    const validated = validateChapterNarrative(chapter, config, chapterKey, minChars);
    logChapterNarrative(chapterKey, "done", { bodyChars: validated.narrativeBody.length, elapsedMs: Date.now() - started, continued: needsContinuation });
    return {
      provider: "deepseek",
      model: result.model,
      setting,
      synopsis,
      config,
      brief,
      chapter: validated
    };
  } catch (error) {
    logChapterNarrative(chapterKey, "error", {
      code: error.code,
      message: error.message,
      elapsedMs: Date.now() - started,
      details: error.details
    });
    throw enrichDeepseekError(error, { chapterKey, chapterIndex: chapterIndex + 1, elapsedMs: Date.now() - started });
  }
}

export async function createDeepseekRolesMetaFromNarrative(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const chapters = Array.isArray(input.chapters) ? input.chapters.map((ch) => validateChapterNarrative(ch, config, ch.chapterKey, chapterNarrativeMinChars(setting, config))) : [];
  if (chapters.length !== config.chapterKeys.length) throwErr("VALIDATION_ERROR", "All chapter narratives required");
  const result = await requestDeepseekJson(
    buildRolesMetaFromNarrativeMessages({ setting, synopsis, chapters }),
    { maxTokens: 4000, temperature: 0.45 }
  );
  const rolesMeta = validateRolesMeta(result.value, setting.playerCount);
  return { provider: "deepseek", model: result.model, setting, synopsis, config, rolesMeta };
}

export async function createDeepseekRoleScriptFromNarrative(input) {
  const started = Date.now();
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const roleKey = cleanText(input.roleKey, 40);
  if (!roleKey) throwErr("VALIDATION_ERROR", "roleKey is required");
  const role = input.role;
  if (!role?.key || role.key !== roleKey) throwErr("VALIDATION_ERROR", "role metadata for roleKey is required");
  const chapterKey = cleanText(input.chapterKey, 40) || null;
  if (chapterKey && !config.chapterKeys.includes(chapterKey)) {
    throwErr("VALIDATION_ERROR", `chapterKey must be one of: ${config.chapterKeys.join(", ")}`);
  }
  const chapters = Array.isArray(input.chapters) ? input.chapters.map((ch) => validateChapterNarrative(ch, config, ch.chapterKey, chapterNarrativeMinChars(setting, config))) : [];
  if (chapters.length !== config.chapterKeys.length) throwErr("VALIDATION_ERROR", "All chapter narratives required");
  const minWords = config.wordsPerSectionMin || 400;
  const existingSections = Array.isArray(input.existingSections) ? input.existingSections : [];
  const requiredChapterKeys = chapterKey ? [chapterKey] : config.chapterKeys;
  const maxTokens = roleScriptMaxTokens(minWords, requiredChapterKeys.length);
  const callTimeoutMs = roleScriptCallTimeoutMs();
  const ctx = { roleKey, chapterKey, sectionCount: requiredChapterKeys.length, minWords, maxTokens };

  logRoleScript(roleKey, "start", { ...ctx, timeoutMs: callTimeoutMs });

  try {
    logRoleScript(roleKey, "request", ctx);
    const result = await requestDeepseekJson(
      buildRoleScriptFromNarrativeMessages({
        setting,
        synopsis,
        role,
        chapters,
        chapterKey,
        existingSections,
        revisionHint: input.revisionHint || ""
      }),
      { maxTokens, temperature: 0.55, timeoutMs: callTimeoutMs, phase: chapterKey ? "section" : "all_sections", context: ctx }
    );
    const parsed = validateRoleScriptFromNarrative(result.value, roleKey, config, minWords, requiredChapterKeys);
    logRoleScript(roleKey, "done", {
      chapterKey,
      sectionChars: Object.fromEntries(Object.entries(parsed.sections).map(([k, s]) => [k, s.body.length])),
      elapsedMs: Date.now() - started
    });
    return {
      provider: "deepseek",
      model: result.model,
      setting,
      synopsis,
      config,
      roleKey,
      chapterKey,
      sections: parsed.sections,
      suggestions: parsed.suggestions
    };
  } catch (error) {
    logRoleScript(roleKey, "error", {
      chapterKey,
      code: error.code,
      message: error.message,
      elapsedMs: Date.now() - started,
      details: error.details
    });
    throw enrichDeepseekError(error, { roleKey, chapterKey, elapsedMs: Date.now() - started });
  }
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
  const { setting, synopsis, config, brief } = resolveCreativePipeline(input);
  const minChars = chapterNarrativeMinChars(setting, config);
  const chapters = Array.isArray(input.chapters) ? input.chapters.map((ch) => validateChapterNarrative(ch, config, ch.chapterKey, minChars)) : [];
  if (!chapters.length) throwErr("VALIDATION_ERROR", "chapters required for structure extraction");
  const sectionsSample = Array.isArray(input.sectionsSample) ? input.sectionsSample : [];
  const result = await requestDeepseekJson(
    buildExtractStructureFromNarrativeMessages({ setting, synopsis, config, chapters, sectionsSample }),
    { maxTokens: 8000, temperature: 0.35 }
  );
  return {
    provider: "deepseek",
    model: result.model,
    setting,
    synopsis,
    config,
    brief,
    proposal: validateDeepseekProposal(result.value)
  };
}

export function validateManuscriptSynopsis(raw, proposal) {
  const value = raw && typeof raw === "object" ? raw : {};
  const overallManuscript = cleanText(value.overallManuscript, 8000);
  if (overallManuscript.length < 400) throwErr("DEEPSEEK_OUTPUT_INVALID", "AI 生成的剧本梗概过短");
  return {
    title: cleanText(value.title, 160) || proposal.title,
    summary: cleanText(value.summary, 1200) || proposal.logline,
    overallManuscript,
    logicNotes: assertArray(value.logicNotes ?? [], "logicNotes").slice(0, 12).map((item) => cleanText(item, 800))
  };
}

function llmNotConfiguredError(runtime) {
  if (runtime.source === "user") throwErr("LLM_USER_NOT_CONFIGURED");
  if (runtime.source === "platform") throwErr("DEEPSEEK_NOT_CONFIGURED");
  throwErr("LLM_NOT_AVAILABLE");
}

function buildChatCompletionBody(runtime, { messages, maxTokens, temperature }) {
  const body = {
    model: runtime.model,
    messages,
    response_format: { type: "json_object" },
    temperature,
    max_tokens: maxTokens
  };
  if (runtime.provider === "deepseek" || String(runtime.baseUrl).includes("deepseek")) {
    body.thinking = { type: "disabled" };
  }
  return body;
}

export async function requestDeepseekJson(messages, { maxTokens = 8000, temperature = 0.5, timeoutMs, phase, context = {}, retryOnJsonParse = true, idempotencyKey = null } = {}) {
  const runtime = getLlmRuntime();
  if (!runtime.configured || !runtime.apiKey) llmNotConfiguredError(runtime);
  const callTimeoutMs = timeoutMs ?? runtime.timeoutMs ?? deepseekConfig().timeoutMs;
  const attempts = retryOnJsonParse ? 2 : 1;
  let lastSyntaxError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), callTimeoutMs);
    try {
      const response = await fetch(`${runtime.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${runtime.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(buildChatCompletionBody(runtime, { messages, maxTokens, temperature })),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const status = response.status;
        const upstreamMsg = payload.error?.message || `HTTP ${status}`;
        if (status === 429) {
          throwErr("RATE_LIMITED", `AI 服务请求过于频繁，请稍后再试。（${upstreamMsg}）`, { phase, attempt, ...context });
        }
        throwErr("DEEPSEEK_API_ERROR", `AI 服务请求失败：${upstreamMsg}`, { phase, attempt, status, source: runtime.source, ...context });
      }
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throwErr("DEEPSEEK_RESPONSE_INVALID", "AI 返回了空内容，请重试。", { phase, attempt, ...context });
      }
      if (runtime.billPlatform && runtime.userId && isCreditsSystemEnabled() && isCreditsDebitAiEnabled()) {
        await chargeAiCredits(runtime.userId, {
          refType: "ai",
          refId: phase || null,
          idempotencyKey: idempotencyKey || (phase ? `ai:${runtime.userId}:${phase}:${attempt}` : null)
        });
      }
      return { model: runtime.model, provider: runtime.source, value: JSON.parse(content) };
    } catch (error) {
      if (error.name === "AbortError") {
        throwErr("GATEWAY_TIMEOUT", `AI 请求超时（已等待 ${Math.round(callTimeoutMs / 1000)} 秒），请稍后重试。`, { phase, attempt, timeoutMs: callTimeoutMs, ...context });
      }
      if (error instanceof SyntaxError) {
        lastSyntaxError = error;
        if (attempt < attempts) continue;
        throwErr("DEEPSEEK_RESPONSE_INVALID", "AI 返回了无法解析的 JSON，请重试。", { phase, attempt, ...context });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throwErr("DEEPSEEK_RESPONSE_INVALID", "AI 返回了无法解析的 JSON，请重试。", { phase, attempt: attempts, ...context, cause: lastSyntaxError?.message });
}

export { validateCreativeSetting, validateSynopsisInput };

function buildConfigFromSetting(setting) {
  const chapterKeys = Array.from({ length: setting.chapterCount }, (_, i) => `ch${i + 1}`);
  const targets = pipelineWordTargets(setting);
  return {
    title: setting.theme,
    playerCount: setting.playerCount,
    chapterCount: setting.chapterCount,
    chapterKeys,
    targetWordCount: setting.chapterCount * targets.perScript,
    wordsPerSectionMin: targets.minScript,
    sceneCount: Math.max(setting.chapterCount * 2, 6),
    investigationPointCount: Math.max(setting.chapterCount * 3, 8),
    clueCount: Math.max(setting.chapterCount * 3, 8),
    constraints: setting.extraConflicts
      ? setting.extraConflicts.split(/\n/).map((line) => line.trim()).filter(Boolean)
      : [],
    notes: [`矩阵流水线 · ${targets.label} · 每幕私人本约 ${targets.perScript} 字`]
  };
}

function briefFromCreative(setting, synopsis) {
  return normalizeStoryBrief({
    title: setting.theme,
    premise: synopsis.body,
    playerCount: setting.playerCount,
    chapterCount: setting.chapterCount,
    wordsPerChapter: setting.wordsPerChapter,
    conflicts: setting.extraConflicts,
    requirements: setting.extraConflicts
  });
}

export function resolveCreativePipeline(input = {}) {
  if (input.setting && input.synopsis) {
    const setting = validateCreativeSetting(input.setting);
    const synopsis = validateSynopsisInput(input.synopsis);
    const brief = briefFromCreative(setting, synopsis);
    const config = validateStorySpec(input.config || buildConfigFromSetting(setting), brief);
    return { setting, synopsis, config, brief };
  }
  const brief = mergeBrief(input);
  const config = validateStorySpec(input.spec || input.config, brief);
  const setting = validateCreativeSetting({
    theme: config.title || brief.title,
    playerCount: config.playerCount,
    chapterCount: config.chapterCount,
    wordsPerChapter: brief.wordsPerChapter || Math.max(800, Math.floor(config.targetWordCount / Math.max(config.chapterCount, 1))),
    extraConflicts: (config.constraints || []).join("\n") || brief.requirements,
    tone: ""
  });
  const synopsis = validateSynopsisInput({
    body: brief.premise,
    charactersSketch: "",
    truthSketch: "",
    redHerringsSketch: ""
  });
  return { setting, synopsis, config, brief };
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
  const validLayers = new Set(["setup", "spec", "narrative", "roles", "roleMatrix", "matrix", "section", "sync", "structure", "evaluate"]);
  const validPriority = new Set(["must_fix", "should_fix", "optional"]);
  const issues = Array.isArray(value.issues) ? value.issues.slice(0, 12).map((item) => ({
    severity: ["high", "medium", "low"].includes(item?.severity) ? item.severity : "medium",
    area: cleanText(item?.area, 80),
    detail: cleanText(item?.detail, 500)
  })) : [];
  const normalizeLayer = (layer) => {
    if (layer === "roleMatrix" || layer === "matrix" || layer === "section") return "roles";
    if (layer === "brief" || layer === "spec" || layer === "outline") return "setup";
    if (layer === "structure" || layer === "synopsis") return "sync";
    return layer;
  };
  const revisions = Array.isArray(value.revisions) ? value.revisions.slice(0, 16).map((item) => {
    const rawLayer = validLayers.has(item?.targetLayer) ? item.targetLayer : "narrative";
    return {
      targetLayer: normalizeLayer(rawLayer),
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
    ? value.nextStepOrder.map((layer) => normalizeLayer(layer)).filter((layer) => validLayers.has(layer) || layer === "setup" || layer === "roles" || layer === "sync").slice(0, 6)
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
