import { throwErr } from "./api-errors.js";
import { clampInteger, cleanText } from "./prompts/shared.js";

const MIN_WORD_COUNT = 500;
const MAX_WORD_COUNT = 20000;
const MIN_PLAYERS = 4;
const MAX_PLAYERS = 8;

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
  const normalizeMetadata = (metadata) => (metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {});
  return {
    title: cleanText(proposal.title, 160),
    logline: cleanText(proposal.logline, 600),
    writingPlan: proposal.writingPlan && typeof proposal.writingPlan === "object" ? proposal.writingPlan : {},
    chapters: chapters.map((chapter, index) => ({
      key: chapter.key,
      title: cleanText(chapter.title, 160) || `Chapter ${index + 1}`,
      summary: cleanText(chapter.summary, 2000),
      metadata: normalizeMetadata(chapter.metadata)
    })),
    scenes: scenes.map((scene, index) => ({
      key: scene.key,
      chapterKey: scene.chapterKey,
      name: cleanText(scene.name, 160) || `Scene ${index + 1}`,
      publicText: cleanText(scene.publicText, 8000),
      hostText: cleanText(scene.hostText, 8000),
      metadata: normalizeMetadata(scene.metadata)
    })),
    investigationPoints: points.map((point, index) => ({
      key: point.key,
      sceneKey: point.sceneKey,
      name: cleanText(point.name, 160) || `Point ${index + 1}`,
      description: cleanText(point.description, 4000),
      resultText: cleanText(point.resultText, 4000),
      clueKey: point.clueKey || null
    })),
    clues: clues.map((clue, index) => ({
      key: clue.key,
      name: cleanText(clue.name, 160) || `Clue ${index + 1}`,
      publicText: cleanText(clue.publicText ?? clue.description, 8000),
      description: cleanText(clue.description, 8000),
      hostText: cleanText(clue.hostText, 8000),
      visibility: ["public", "host", "role"].includes(clue.visibility) ? clue.visibility : "role",
      type: cleanText(clue.type, 80),
      clueType: cleanText(clue.clueType, 80),
      importance: cleanText(clue.importance, 80),
      metadata: normalizeMetadata(clue.metadata)
    })),
    edges: edges.map((edge) => ({
      fromType: edge.fromType,
      fromKey: edge.fromKey,
      toType: edge.toType,
      toKey: edge.toKey,
      relationType: edge.relationType,
      label: cleanText(edge.label, 160)
    })),
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

export function chapterNarrativeMinChars(setting, config) {
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
