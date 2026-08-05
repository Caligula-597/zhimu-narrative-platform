/**
 * Structured script generation — three isolated channels stitched mechanically.
 * Pure functions + validators; LLM prompts live in matrix-structured-script.js.
 * v5.5: spoiler-only hard gates; psychology allowed; relative time; AI cliche advisory.
 */
import { cleanText } from "./prompts/shared.js";
import { buildAuthorizedClueNames } from "./pipeline-matrix-script-gates.js";
import { scanAiClicheAdvisory, scanHeartVerbAdvisory, scanMontageAdvisory } from "./prompts/matrix-speech-style.js";
import { scanKnowledgeLeakHeuristic } from "./prompts/matrix-knowledge-audit.js";
import {
  buildEntityUnlockSchedule,
  scanDialogueEntities,
  substituteEarlyEntityAliases
} from "./prompts/matrix-entity-unlock.js";
import { resolveKillerAwareness, killerFeelingEmotionForAct } from "./prompts/matrix-killer-awareness.js";
import { killerPrivateScriptSpoilerExempt } from "./prompts/matrix-fairness-model.js";

export const FEELING_PREFIX_PUZZLE = "[规定疑惑]";
export const FEELING_PREFIX_EMOTION = "[规定情绪]";

export const PROMPT_VERSION_STRUCTURED = "matrix-v5.7-context-isolated";

/** 剧透级表述 — 正常心理描写（感到/心想/紧张）不在此列 */
const SPOILER_LEAK_IN_NARRATIVE =
  /(?:凶手就是我|是我杀|是我推|我害的|我杀了他|担心杀人败露|回忆.{0,10}(?:作案|推落|暗害|灭口)|(?:清楚|知道).{0,6}(?:是我|凶手).{0,4}(?:杀|害|做))/;

/** 非凶手终幕「假认罪」— 完整杀人手法链，会污染非凶手推真相 */
const INNOCENT_FALSE_CONFESSION =
  /(?:密室是我所设|通过.{0,8}机关.{0,12}(?:注入|进入|杀害)|用.{0,6}(?:安眠药|迷药).{0,12}(?:再通过|然后).{0,12}(?:注入|进入|杀害)|(?:注入|投下).{0,4}氰化物|我承认.{0,20}(?:注入|投毒|杀害|杀人))/;

export function scanInnocentFalseConfession(text, { isKiller = false, actIndex = 0, finalActIndex = 0 } = {}) {
  if (isKiller || actIndex < finalActIndex) return { passed: true, violations: [] };
  const raw = String(text || "");
  const violations = [];
  for (const sentence of raw.split(/(?<=[。！？\n])/)) {
    if (INNOCENT_FALSE_CONFESSION.test(sentence)) {
      violations.push({ type: "innocentFalseConfession", sentence: sentence.trim().slice(0, 120) });
    }
  }
  return { passed: violations.length === 0, violations };
}

/** @deprecated v5.4 前用于心理拦截；保留导出供旧测试对照 */
export const PSYCHOLOGY_IN_ACTION = SPOILER_LEAK_IN_NARRATIVE;

const KILLER_FEELING_LEAK = /复仇|恐惧|销毁|证据|细线|门闩|灭口|走私|机关|钥匙胚|空虚|比对残留/;

const NEUTRAL_KILLER_EMOTIONS = {
  ch1: "保持冷静，避免过早引起注意。",
  ch2: "保持冷静，避免被怀疑。",
  ch3: "保持表面镇定，留意他人动向。"
};

const CRIME_ENTITY_TOKENS = ["细线", "门闩", "钥匙胚", "旋转开关", "暗格", "走私"];

/** Rule-filled feelings — killer early acts depend on killerAwareness mode. */
export function fillFeelingPack({
  matrixRow,
  characterArchive,
  actKey,
  isKiller = false,
  actIndex = 0,
  finalActIndex = 0,
  killerAwareness = "self-aware"
}) {
  const puzzles = [];
  const emotions = [];
  if (matrixRow?.suspicion) {
    puzzles.push(`${FEELING_PREFIX_PUZZLE} ${cleanText(matrixRow.suspicion, 200)}`);
  }
  if (matrixRow?.misbeliefs) {
    puzzles.push(`${FEELING_PREFIX_PUZZLE} ${cleanText(matrixRow.misbeliefs, 200)}`);
  }

  const killerEarly = isKiller && actIndex < finalActIndex;
  const selfAwareEmotion = killerFeelingEmotionForAct({
    killerAwareness: resolveKillerAwareness({ killerAwareness }),
    actKey,
    actIndex,
    finalActIndex,
    isKiller
  });

  if (killerEarly && selfAwareEmotion) {
    emotions.push(`${FEELING_PREFIX_EMOTION} ${selfAwareEmotion}`);
  } else if (killerEarly && resolveKillerAwareness({ killerAwareness }) === "self-unaware") {
    if (characterArchive?.innerConflict) {
      emotions.push(`${FEELING_PREFIX_EMOTION} ${cleanText(characterArchive.innerConflict, 160)}`);
    }
    const actTask = (characterArchive?.actTasks || []).find((t) => t.actKey === actKey);
    if (actTask?.tips) {
      emotions.push(`${FEELING_PREFIX_EMOTION} ${cleanText(actTask.tips.replace(/^【提示】/, ""), 160)}`);
    }
  } else if (!isKiller) {
    if (characterArchive?.innerConflict) {
      emotions.push(`${FEELING_PREFIX_EMOTION} ${cleanText(characterArchive.innerConflict, 160)}`);
    }
    const actTask = (characterArchive?.actTasks || []).find((t) => t.actKey === actKey);
    if (actTask?.tips) {
      emotions.push(`${FEELING_PREFIX_EMOTION} ${cleanText(actTask.tips.replace(/^【提示】/, ""), 160)}`);
    }
  } else if (matrixRow?.suspicion) {
    emotions.push(`${FEELING_PREFIX_EMOTION} ${cleanText(matrixRow.suspicion, 120)}`);
  }

  return sanitizeFeelingsPack(
    {
      puzzles: [...new Set(puzzles)].slice(0, 3),
      emotions: [...new Set(emotions)].slice(0, 2)
    },
    { isKiller, actIndex, finalActIndex }
  );
}

export function sanitizeFeelingsPack(feelingsPack, { isKiller, actIndex, finalActIndex }) {
  const pack = feelingsPack || { puzzles: [], emotions: [] };
  const filterLine = (line) => {
    const body = String(line || "");
    if (!KILLER_FEELING_LEAK.test(body)) return body;
    if (isKiller && actIndex < finalActIndex) {
      return `${FEELING_PREFIX_EMOTION} ${NEUTRAL_KILLER_EMOTIONS.ch2}`;
    }
    return "";
  };
  return {
    puzzles: (pack.puzzles || []).map(filterLine).filter(Boolean).slice(0, 3),
    emotions: (pack.emotions || []).map(filterLine).filter(Boolean).slice(0, 2)
  };
}

/** Killer matrix row: passive tasks, no「我的细线」/作案认知。 */
export function sanitizeMatrixRowForStructured({ matrixRow, isKiller, actIndex, finalActIndex }) {
  if (!matrixRow) return matrixRow;
  if (!isKiller || actIndex >= finalActIndex) return matrixRow;
  const tasks = (matrixRow.tasks || []).map((t) => {
    let s = String(t);
    s = s.replace(/与我的细线匹配|我的细线|比对细线残留|比对.{0,6}细线/g, "检查现场是否有异常痕迹");
    s = s.replace(/销毁证据|灭口/g, "整理个人物品");
    if (/细线/.test(s) && /门闩|残留|比对/.test(s)) {
      s = "按排班巡视通讯室与走廊，记录设备读数。";
    }
    return cleanText(s, 300);
  });
  return { ...matrixRow, tasks };
}

/** Public-facing action brief — matrix tasks + archive timeline + optional act outline from novel layer. */
export function buildPublicActionBrief({ characterArchive, matrixRow, actKey, actIndex, actOutline }) {
  const tasks = (matrixRow?.tasks || []).map((t) => cleanText(t, 120));
  const lies = (matrixRow?.lies || []).slice(0, 2).map((l) => cleanText(l, 120));
  const brief = {
    actKey,
    actIndex,
    roleName: characterArchive?.name,
    publicIdentity: cleanText(characterArchive?.publicIdentity, 200),
    voiceHints: cleanText(characterArchive?.voiceHints, 160),
    scheduledTasks: tasks,
    outwardStatements: lies,
    rule: "写本幕经历：相对顺序（随后/这时），勿每句死钟点；心理描写主要在公聊段，但可短句点缀。禁止剧透与未授权物证专名。禁止群像快剪——先写本角色，再顺带他人；勿把 L2 公共池逐人罗列成一段。outwardStatements 只允许作为引号内对外口径，私人叙述不得把角色自己的锁定行动事实写反。"
  };
  if (actOutline?.outline) {
    brief.actOutline = cleanText(actOutline.outline, 800);
    brief.knowledgeSources = (actOutline.knowledgeSources || []).slice(0, 8);
    brief.unknowns = (actOutline.unknowns || []).slice(0, 6);
    brief.rule +=
      " actOutline 是可玩纲要：只扩写 knowledgeSources 中的事实；unknowns 中的内容不得写穿；勿把 outline 改成全场群像摘要。";
  }
  return brief;
}

export function validateActionLog(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const entries = Array.isArray(value.entries) ? value.entries.slice(0, 24) : [];
  const narrative = cleanText(value.narrative || entries.map((e) => `${e.time || ""} ${e.action || ""}`).join(" "), 8000);
  return { entries, narrative };
}

export function validateDialogueLog(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const dialogues = Array.isArray(value.dialogues) ? value.dialogues.slice(0, 16) : [];
  const observations = Array.isArray(value.observations) ? value.observations.slice(0, 16) : [];
  const narrative = cleanText(
    value.narrative ||
      [
        ...dialogues.map((d) => `${d.speaker || "某人"}说：「${d.line || ""}」`),
        ...observations.map((o) => `（观察到）${o.target || ""} ${o.note || ""}`)
      ].join("\n"),
    8000
  );
  return { dialogues, observations, narrative };
}

export function scanActionCrimeTokens(text, { isKiller = false, actIndex = 0, finalActIndex = 0 } = {}) {
  if (!isKiller || actIndex >= finalActIndex) return { passed: true, violations: [] };
  const raw = String(text || "");
  const violations = [];
  if (/细线/.test(raw) && /门闩|残留|比对/.test(raw)) {
    violations.push({ type: "crimeTokenCombo", detail: "细线+门闩/残留/比对" });
  }
  for (const token of CRIME_ENTITY_TOKENS) {
    if (raw.includes(token)) {
      violations.push({ type: "crimeEntityInAction", token });
    }
  }
  return { passed: violations.length === 0, violations };
}

export function stripCrimeTokensFromAction(text) {
  let out = String(text || "");
  for (const token of CRIME_ENTITY_TOKENS) {
    out = out.replace(new RegExp(token, "g"), "物品");
  }
  out = out.replace(/比对.{0,12}残留/g, "查看周围");
  return cleanText(out, 8000);
}

export function scanSpoilerLeakInNarrative(text, context = {}) {
  const { isKiller = false, killerAwareness = "self-aware", actIndex = 0, finalActIndex = 0 } = context;
  if (killerPrivateScriptSpoilerExempt({ isKiller, killerAwareness, actIndex, finalActIndex })) {
    return { passed: true, violations: [], exempt: "killer_self_aware_private" };
  }
  const raw = String(text || "");
  const violations = [];
  for (const sentence of raw.split(/(?<=[。！？\n])/)) {
    if (SPOILER_LEAK_IN_NARRATIVE.test(sentence)) {
      violations.push({ type: "spoilerLeak", sentence: sentence.trim().slice(0, 100) });
    }
  }
  return { passed: violations.length === 0, violations };
}

/** 仅删除含剧透自白的句子；真凶自知私人本不 strip */
export function stripSpoilerLeakFromNarrative(text, context = {}) {
  if (killerPrivateScriptSpoilerExempt(context)) {
    return cleanText(String(text || ""), 8000);
  }
  return String(text || "")
    .split(/(?<=[。！？\n])/)
    .filter((s) => s.trim() && !SPOILER_LEAK_IN_NARRATIVE.test(s))
    .join("")
    .trim();
}

/** @deprecated 使用 scanSpoilerLeakInNarrative */
export function scanActionLogPsychology(text, context) {
  return scanSpoilerLeakInNarrative(text, context);
}

/** @deprecated 使用 stripSpoilerLeakFromNarrative */
export function stripPsychologyFromAction(text, context) {
  return stripSpoilerLeakFromNarrative(text, context);
}

/**  advisory：精确钟点过多会让剧本像日志；不阻断生成 */
export function scanRigidClockTimestamps(text, { maxPer500Chars = 4 } = {}) {
  const raw = String(text || "");
  const matches = raw.match(/\d{1,2}:\d{2}/g) || [];
  const density = raw.length > 0 ? matches.length / (raw.length / 500) : 0;
  return {
    passed: density <= maxPer500Chars,
    count: matches.length,
    density,
    advisory: density > maxPer500Chars ? "clock_timestamps_dense" : null
  };
}

export { scanDialogueEntities } from "./prompts/matrix-entity-unlock.js";

export function scanPersonaBleed(text, roleKey, characterArchives) {
  const body = String(text || "");
  const violations = [];
  // 多人剧本公聊会互提他人职业/物证 — 仅保留「把自己当他人第三人称旁观」类硬错误
  const self = characterArchives?.roles?.find((r) => r.key === roleKey);
  const selfFirst = self?.name?.split("·")[0]?.trim();
  if (selfFirst && new RegExp(`看见${selfFirst}站在|${selfFirst}站在.*门口`).test(body)) {
    violations.push({ type: "selfObservation", match: selfFirst });
  }
  return {
    passed: violations.length === 0,
    violations,
    advisory: violations.length ? "self_observation_only" : null
  };
}

export function stitchStructuredScript({ actionLog, feelingsPack, dialogueLog, roleName }) {
  const parts = [];
  if (actionLog?.narrative) parts.push(actionLog.narrative);
  const selfName = cleanText(roleName, 80).split("·")[0].trim();
  const dialogueLines = (dialogueLog?.dialogues || [])
    .map((item) => {
      const speaker = cleanText(item?.speaker, 80);
      const line = cleanText(item?.line, 300).replace(/^[「“\"]|[」”\"]$/g, "");
      const speakerName = speaker.split("·")[0].trim();
      const label = selfName && speakerName === selfName ? "你" : speakerName;
      return label && line ? `${label}说：「${line}」` : "";
    })
    .filter(Boolean);
  const observationLines = (dialogueLog?.observations || [])
    .map((item) => {
      const target = cleanText(item?.target, 80).split("·")[0].trim();
      const note = cleanText(item?.note, 240);
      const label = selfName && target === selfName ? "你" : target;
      return label && note ? `${label}：${note}` : note;
    })
    .filter((line) => line && !String(actionLog?.narrative || "").includes(line))
    .slice(0, 4);
  const publicContinuation = [...dialogueLines, ...observationLines].join("\n");
  if (publicContinuation) parts.push(publicContinuation);
  else if (dialogueLog?.narrative) parts.push(dialogueLog.narrative);
  return cleanText(parts.join("\n\n"), 12000);
}

export function applyStructuredGates({
  actionLog,
  feelingsPack,
  dialogueLog,
  roleKey,
  characterArchives,
  infoMatrix,
  matrixRow,
  actKey,
  config,
  isKiller = false,
  actIndex = 0,
  finalActIndex = 0,
  minWords = 0,
  killerAwareness = "self-aware",
  actOutline = null,
  priorKnowledgeFacts = [],
  priorScriptBodies = []
}) {
  const spoilerCtx = { isKiller, killerAwareness, actIndex, finalActIndex };
  const authorized = buildAuthorizedClueNames(infoMatrix, matrixRow, actKey, config);
  const entitySchedule = buildEntityUnlockSchedule(infoMatrix, config);
  let actionNarrative = stripSpoilerLeakFromNarrative(actionLog.narrative, spoilerCtx);
  if (isKiller && actIndex < finalActIndex) {
    actionNarrative = stripCrimeTokensFromAction(actionNarrative);
  }
  actionNarrative = substituteEarlyEntityAliases(actionNarrative, actKey, config, entitySchedule);
  let dialogueNarrative = stripSpoilerLeakFromNarrative(dialogueLog.narrative, spoilerCtx);
  dialogueNarrative = substituteEarlyEntityAliases(dialogueNarrative, actKey, config, entitySchedule);
  const actionSpoiler = scanSpoilerLeakInNarrative(actionNarrative, spoilerCtx);
  const actionCrime = scanActionCrimeTokens(actionNarrative, { isKiller, actIndex, finalActIndex });
  const dialogueSpoiler = scanSpoilerLeakInNarrative(dialogueNarrative, spoilerCtx);
  const innocentConfession = scanInnocentFalseConfession(`${actionNarrative}\n${dialogueNarrative}`, {
    isKiller,
    actIndex,
    finalActIndex
  });
  const dialogueEnt = scanDialogueEntities(dialogueNarrative, authorized, {
    actKey,
    config,
    schedule: entitySchedule,
    personalEarlyInAction: true,
    channel: "dialogue"
  });
  const clockAdvisory = scanRigidClockTimestamps(`${actionNarrative}\n${dialogueNarrative}`);
  const aiClicheAdvisory = scanAiClicheAdvisory(`${actionNarrative}\n${dialogueNarrative}`);
  const heartVerbAdvisory = scanHeartVerbAdvisory(`${actionNarrative}\n${dialogueNarrative}`);
  const rosterNames = (characterArchives?.roles || []).map((r) => r.name).filter(Boolean);
  const montageAdvisory = scanMontageAdvisory(`${actionNarrative}\n${dialogueNarrative}`.slice(0, 500), {
    roleRosterNames: rosterNames
  });
  const knowledgeLeakHeuristic = scanKnowledgeLeakHeuristic(`${actionNarrative}\n${dialogueNarrative}`, {
    actOutline,
    priorKnowledgeFacts,
    priorScriptBodies,
    isKiller
  });
  const persona = scanPersonaBleed(
    `${actionNarrative}\n${dialogueNarrative}`,
    roleKey,
    characterArchives
  );
  const safeFeelings = sanitizeFeelingsPack(feelingsPack, { isKiller, actIndex, finalActIndex });
  const minChannel = minWords > 0 ? Math.max(80, Math.round(minWords * 0.25)) : 0;
  const lengthOk =
    !minChannel ||
    (actionNarrative.length >= minChannel && dialogueNarrative.length >= minChannel);
  const gates = {
    actionSpoilerLeak: actionSpoiler,
    actionCrimeTokens: actionCrime,
    dialogueSpoilerLeak: dialogueSpoiler,
    innocentFalseConfession: innocentConfession,
    dialogueEntities: dialogueEnt,
    clockTimestampAdvisory: clockAdvisory,
    aiClicheAdvisory,
    heartVerbAdvisory,
    montageAdvisory,
    knowledgeLeakHeuristic,
    personaBleed: persona,
    channelLength: { passed: lengthOk, minChannel, actionLen: actionNarrative.length, dialogueLen: dialogueNarrative.length },
    feelingsPack: {
      passed: !(safeFeelings.emotions || []).some((e) => KILLER_FEELING_LEAK.test(e)),
      count: (safeFeelings.puzzles?.length || 0) + (safeFeelings.emotions?.length || 0)
    },
    /** @deprecated */ actionPsychology: actionSpoiler,
    /** @deprecated */ dialoguePsychology: dialogueSpoiler
  };
  const passed =
    actionSpoiler.passed &&
    actionCrime.passed &&
    dialogueSpoiler.passed &&
    innocentConfession.passed &&
    dialogueEnt.passed &&
    persona.passed &&
    gates.feelingsPack.passed &&
    lengthOk;
  return {
    passed,
    gates,
    actionLog: { ...actionLog, narrative: actionNarrative },
    feelingsPack: safeFeelings,
    dialogueLog: { ...dialogueLog, narrative: dialogueNarrative }
  };
}
