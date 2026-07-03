/**
 * Matrix-first pipeline — validators, word targets, mechanical proposal builder.
 */
import { throwErr } from "./api-errors.js";
import { cleanText } from "./prompts/shared.js";

const MAX_PLAYERS = 8;

function assertArray(value, name) {
  if (!Array.isArray(value)) throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 返回的 ${name} 不是数组`);
  return value;
}

function uniqueKeys(items, name) {
  const keys = new Set();
  for (const item of items) {
    const key = item?.key;
    if (!key || typeof key !== "string") throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 返回的 ${name} 缺少 key`);
    if (keys.has(key)) throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 返回的 ${name} 存在重复 key：${key}`);
    keys.add(key);
  }
  return keys;
}

export const VOLUME_TIERS = ["demo", "standard", "epic"];

export function pipelineWordTargets(setting = {}) {
  const tier = VOLUME_TIERS.includes(setting.volumeTier) ? setting.volumeTier : "standard";
  const map = {
    demo: { perScript: 800, minScript: 400, label: "示范档" },
    standard: { perScript: 1500, minScript: 600, label: "标准档" },
    epic: { perScript: 4000, minScript: 2000, label: "完整档" }
  };
  return { tier, ...map[tier] };
}

export function pipelineScriptMinWords(session) {
  const setting = session?.setting || {};
  return session?.config?.wordsPerSectionMin || pipelineWordTargets(setting).minScript;
}

export function validateTruthBible(raw, config) {
  const value = raw && typeof raw === "object" ? raw : {};
  const chapterKeys = config?.chapterKeys || [];
  const timeline = assertArray(value.timeline ?? [], "timeline").slice(0, 24).map((row, index) => ({
    id: cleanText(row.id, 40) || `t-${index + 1}`,
    time: cleanText(row.time, 120),
    event: cleanText(row.event, 800),
    participants: assertArray(row.participants ?? [], "timeline.participants").slice(0, 8).map((p) => cleanText(p, 80))
  }));
  const misdirections = assertArray(value.misdirections ?? [], "misdirections").slice(0, 5).map((row, index) => ({
    layer: Number(row.layer) || index + 1,
    surface: cleanText(row.surface, 600),
    misleading: cleanText(row.misleading, 600),
    resolution: cleanText(row.resolution, 600)
  }));
  const spoilerGates = assertArray(value.spoilerGates ?? [], "spoilerGates").slice(0, 12).map((row) => ({
    actKey: chapterKeys.includes(row.actKey) ? row.actKey : chapterKeys[0],
    forbiddenFacts: assertArray(row.forbiddenFacts ?? [], "forbiddenFacts").slice(0, 12).map((f) => cleanText(f, 300))
  }));
  const summary = cleanText(value.summary, 4000);
  const killer = cleanText(value.killer, 200);
  const method = cleanText(value.method, 1200);
  const motive = cleanText(value.motive, 1200);
  if (summary.length < 200) throwErr("DEEPSEEK_OUTPUT_INVALID", "真相档案摘要过短（至少 200 字）");
  if (!killer || !method) throwErr("DEEPSEEK_OUTPUT_INVALID", "真相档案需包含凶手与手法");
  return {
    summary,
    killer,
    method,
    motive,
    victim: cleanText(value.victim, 200),
    timeline,
    misdirections,
    spoilerGates,
    hostNotes: cleanText(value.hostNotes, 3000),
    suggestions: assertArray(value.suggestions ?? [], "suggestions").slice(0, 12).map((s) => cleanText(s, 500))
  };
}

export function validateCharacterArchives(raw, config) {
  const value = raw && typeof raw === "object" ? raw : {};
  const playerCount = config?.playerCount || 6;
  const chapterKeys = config?.chapterKeys || [];
  const roles = assertArray(value.roles ?? [], "roles").slice(0, MAX_PLAYERS);
  if (roles.length !== playerCount) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", `角色档案需恰好 ${playerCount} 位，实际 ${roles.length} 位`);
  }
  for (const [index, role] of roles.entries()) {
    if (!role.key) role.key = `role-${index + 1}`;
    role.name = cleanText(role.name, 80);
    role.publicIdentity = cleanText(role.publicIdentity || role.publicProfile, 800);
    role.hiddenIdentity = cleanText(role.hiddenIdentity, 1200);
    role.motive = cleanText(role.motive, 800);
    role.relationships = cleanText(role.relationships, 1200);
    role.timelineActions = cleanText(role.timelineActions, 1500);
    role.innerConflict = cleanText(role.innerConflict, 800);
    role.voiceHints = cleanText(role.voiceHints, 600);
    role.lies = assertArray(role.lies ?? [], "lies").slice(0, 5).map((l) => cleanText(l, 400));
    role.actTasks = assertArray(role.actTasks ?? [], "actTasks").slice(0, 12).map((row) => ({
      actKey: chapterKeys.includes(row.actKey) ? row.actKey : chapterKeys[0],
      tasks: assertArray(row.tasks ?? [], "tasks").slice(0, 6).map((t) => cleanText(t, 300)),
      tips: cleanText(row.tips, 600)
    }));
    if (!role.name) throwErr("DEEPSEEK_OUTPUT_INVALID", `角色 ${role.key} 缺少 name`);
  }
  uniqueKeys(roles, "roles");
  return {
    roles,
    suggestions: assertArray(value.suggestions ?? [], "suggestions").slice(0, 12).map((s) => cleanText(s, 500))
  };
}

export function validateInfoMatrix(raw, config, characterArchives) {
  const value = raw && typeof raw === "object" ? raw : {};
  const chapterKeys = config?.chapterKeys || [];
  const roleKeys = new Set((characterArchives?.roles || []).map((r) => r.key));
  const clues = assertArray(value.clues ?? [], "clues").slice(0, 80);
  for (const [index, clue] of clues.entries()) {
    if (!clue.key) clue.key = `clue-${index + 1}`;
    clue.name = cleanText(clue.name, 120);
    clue.description = cleanText(clue.description || clue.summary, 800);
    clue.actKey = chapterKeys.includes(clue.actKey) ? clue.actKey : chapterKeys[0];
    clue.grantMode = ["auto", "host_confirm", "explore"].includes(clue.grantMode) ? clue.grantMode : "auto";
  }
  const rows = assertArray(value.rows ?? [], "rows").slice(0, 120);
  const clueKeys = new Set(clues.map((c) => c.key));
  for (const row of rows) {
    if (!roleKeys.has(row.roleKey)) throwErr("DEEPSEEK_OUTPUT_INVALID", `信息矩阵引用了未知角色：${row.roleKey}`);
    if (!chapterKeys.includes(row.actKey)) throwErr("DEEPSEEK_OUTPUT_INVALID", `信息矩阵引用了未知幕：${row.actKey}`);
    row.newClueIds = assertArray(row.newClueIds ?? [], "newClueIds").slice(0, 12).filter((id) => clueKeys.has(id));
    row.misbeliefs = cleanText(row.misbeliefs, 800);
    row.suspicion = cleanText(row.suspicion, 400);
    row.forbidden = cleanText(row.forbidden, 800);
    row.lies = assertArray(row.lies ?? [], "lies").slice(0, 4).map((l) => cleanText(l, 300));
    row.tasks = assertArray(row.tasks ?? [], "tasks").slice(0, 6).map((t) => cleanText(t, 300));
  }
  uniqueKeys(clues, "clues");
  const actTitles = value.actTitles && typeof value.actTitles === "object" ? value.actTitles : {};
  const actSummaries = value.actSummaries && typeof value.actSummaries === "object" ? value.actSummaries : {};
  return {
    clues,
    rows,
    actTitles: Object.fromEntries(chapterKeys.map((key) => [key, cleanText(actTitles[key], 120) || `第 ${chapterKeys.indexOf(key) + 1} 幕`])),
    actSummaries: Object.fromEntries(chapterKeys.map((key) => [key, cleanText(actSummaries[key], 600)])),
    suggestions: assertArray(value.suggestions ?? [], "suggestions").slice(0, 12).map((s) => cleanText(s, 500))
  };
}

export function validateHostRunbooks(raw, config) {
  const value = raw && typeof raw === "object" ? raw : {};
  const chapterKeys = config?.chapterKeys || [];
  const runbooks = assertArray(value.runbooks ?? [], "runbooks").slice(0, 12);
  for (const book of runbooks) {
    if (!chapterKeys.includes(book.actKey)) throwErr("DEEPSEEK_OUTPUT_INVALID", `主持手册引用了未知幕：${book.actKey}`);
    book.title = cleanText(book.title, 160);
    book.flow = cleanText(book.flow, 2000);
    book.hostTruth = cleanText(book.hostTruth, 2000);
    book.clueGrants = assertArray(book.clueGrants ?? [], "clueGrants").slice(0, 16).map((g) => ({
      clueId: cleanText(g.clueId, 40),
      when: cleanText(g.when, 400)
    }));
    book.fallbacks = assertArray(book.fallbacks ?? [], "fallbacks").slice(0, 6).map((f) => cleanText(f, 400));
  }
  return {
    runbooks,
    suggestions: assertArray(value.suggestions ?? [], "suggestions").slice(0, 12).map((s) => cleanText(s, 500))
  };
}

export function validateMatrixPlayerScript(raw, roleKey, actKey, minWords) {
  const value = raw && typeof raw === "object" ? raw : {};
  if (value.roleKey !== roleKey || value.actKey !== actKey) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "剧本 roleKey/actKey 与请求不一致");
  }
  const body = cleanText(value.body, 12000);
  if (body.length < minWords) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", `剧本正文仅 ${body.length} 字，未达到最低 ${minWords} 字`, { actualChars: body.length, minChars: minWords, roleKey, actKey });
  }
  return {
    roleKey,
    actKey,
    title: cleanText(value.title, 160) || `${actKey} · 私人本`,
    body,
    tasks: assertArray(value.tasks ?? [], "tasks").slice(0, 6).map((t) => cleanText(t, 300)),
    closingHook: cleanText(value.closingHook, 400)
  };
}

export function characterArchivesToRolesMeta(characterArchives, infoMatrix, config) {
  const chapterKeys = config?.chapterKeys || [];
  const rowsByRole = new Map();
  for (const row of infoMatrix?.rows || []) {
    if (!rowsByRole.has(row.roleKey)) rowsByRole.set(row.roleKey, []);
    rowsByRole.get(row.roleKey).push(row);
  }
  return {
    roles: (characterArchives?.roles || []).map((role) => ({
      key: role.key,
      name: role.name,
      publicProfile: role.publicIdentity,
      privateProfile: [role.hiddenIdentity, role.motive ? `动机：${role.motive}` : "", role.innerConflict ? `矛盾：${role.innerConflict}` : ""].filter(Boolean).join("\n"),
      chapterKnowledge: chapterKeys.map((actKey) => {
        const row = (rowsByRole.get(role.key) || []).find((r) => r.actKey === actKey);
        return {
          chapterKey: actKey,
          knows: row ? [row.newClueIds?.length ? `新线索：${row.newClueIds.join("、")}` : "", row.suspicion ? `怀疑：${row.suspicion}` : ""].filter(Boolean).join("；") : "（本幕尚未获知关键线索）",
          mustHide: row?.forbidden || role.lies?.slice(0, 2).join("；") || "（无额外隐瞒）",
          canDiscuss: row?.tasks?.join("；") || "按本幕任务推进"
        };
      })
    }))
  };
}

export function buildProposalFromMatrix({ setting, config, truthBible, infoMatrix }) {
  const chapterKeys = config?.chapterKeys || [];
  const title = config?.title || setting?.theme || "剧本";
  const chapters = chapterKeys.map((key, index) => ({
    key,
    title: infoMatrix?.actTitles?.[key] || `第 ${index + 1} 幕`,
    summary: infoMatrix?.actSummaries?.[key] || cleanText(truthBible?.summary, 300),
    sequence: index + 1
  }));
  const scenes = chapterKeys.map((key, index) => ({
    key: `scene-${index + 1}`,
    chapterKey: key,
    name: infoMatrix?.actTitles?.[key] || `场景 ${index + 1}`,
    publicText: infoMatrix?.actSummaries?.[key] || "",
    hostText: (truthBible?.hostNotes || "").slice(0, 800)
  }));
  const clues = (infoMatrix?.clues || []).map((clue, index) => {
    const sceneIndex = Math.max(0, chapterKeys.indexOf(clue.actKey));
    return {
      key: clue.key || `clue-${index + 1}`,
      name: clue.name || `线索 ${index + 1}`,
      description: clue.description || "",
      sceneKey: `scene-${sceneIndex + 1}`,
      visibility: "private",
      metadata: { grantMode: clue.grantMode || "auto", actKey: clue.actKey }
    };
  });
  const investigationPoints = clues.map((clue, index) => ({
    key: `point-${index + 1}`,
    sceneKey: clue.sceneKey,
    name: clue.name,
    clueKey: clue.key,
    description: clue.description
  }));
  const edges = clues.map((clue, index) => ({
    fromType: "scene",
    fromKey: clue.sceneKey,
    toType: "clue",
    toKey: clue.key,
    relationType: index === 0 ? "mainline" : "parallel"
  }));
  return {
    title,
    logline: cleanText(truthBible?.summary, 600),
    chapters,
    scenes,
    investigationPoints,
    clues,
    edges,
    suggestions: infoMatrix?.suggestions || []
  };
}

export function matrixScriptsToSections(scripts) {
  const sections = {};
  for (const [roleKey, acts] of Object.entries(scripts || {})) {
    sections[roleKey] = {};
    for (const [actKey, script] of Object.entries(acts || {})) {
      if (!script?.body) continue;
      sections[roleKey][actKey] = {
        title: script.title,
        body: script.body,
        tasks: script.tasks,
        closingHook: script.closingHook
      };
    }
  }
  return sections;
}
