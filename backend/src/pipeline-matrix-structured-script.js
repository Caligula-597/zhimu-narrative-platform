/**
 * Structured script generation — three isolated channels stitched mechanically.
 * Pure functions + validators; LLM prompts live in matrix-structured-script.js.
 */
import { cleanText } from "./prompts/shared.js";
import { buildAuthorizedClueNames } from "./pipeline-matrix-script-gates.js";

export const FEELING_PREFIX_PUZZLE = "[规定疑惑]";
export const FEELING_PREFIX_EMOTION = "[规定情绪]";

const PSYCHOLOGY_IN_ACTION = /(?:感到|觉得|想起|回忆|心里|内心|害怕|紧张|犹豫|清楚|必须|不敢|确信|怀疑.{0,6}凶手|一时冲动|为了.{0,8}测试|走私|设置机关|推了|碰过.{0,6}开关)/;

/** Rule-filled feelings — no LLM. */
export function fillFeelingPack({ matrixRow, characterArchive, actKey }) {
  const puzzles = [];
  const emotions = [];
  if (matrixRow?.suspicion) {
    puzzles.push(`${FEELING_PREFIX_PUZZLE} ${cleanText(matrixRow.suspicion, 200)}`);
  }
  if (matrixRow?.misbeliefs) {
    puzzles.push(`${FEELING_PREFIX_PUZZLE} ${cleanText(matrixRow.misbeliefs, 200)}`);
  }
  if (characterArchive?.innerConflict) {
    emotions.push(`${FEELING_PREFIX_EMOTION} ${cleanText(characterArchive.innerConflict, 160)}`);
  }
  const actTask = (characterArchive?.actTasks || []).find((t) => t.actKey === actKey);
  if (actTask?.tips) {
    emotions.push(`${FEELING_PREFIX_EMOTION} ${cleanText(actTask.tips.replace(/^【提示】/, ""), 160)}`);
  }
  return {
    puzzles: [...new Set(puzzles)].slice(0, 3),
    emotions: [...new Set(emotions)].slice(0, 2)
  };
}

/** Public-facing action brief — matrix tasks + archive timeline (no truth-bible killer facts). */
export function buildPublicActionBrief({ characterArchive, matrixRow, actKey, actIndex }) {
  const tasks = (matrixRow?.tasks || []).map((t) => cleanText(t, 120));
  const lies = (matrixRow?.lies || []).slice(0, 2).map((l) => cleanText(l, 120));
  return {
    actKey,
    actIndex,
    roleName: characterArchive?.name,
    publicIdentity: cleanText(characterArchive?.publicIdentity, 200),
    scheduledTasks: tasks,
    outwardStatements: lies,
    rule: "只写可被监控拍到的物理行为；禁止动机、心理、手法、认罪。"
  };
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

export function scanActionLogPsychology(text) {
  const raw = String(text || "");
  const violations = [];
  for (const sentence of raw.split(/(?<=[。！？\n])/)) {
    if (PSYCHOLOGY_IN_ACTION.test(sentence)) {
      violations.push({ type: "psychologyInAction", sentence: sentence.trim().slice(0, 100) });
    }
  }
  return { passed: violations.length === 0, violations };
}

/** Strip sentences with psychology/motive from action narrative. */
export function stripPsychologyFromAction(text) {
  return String(text || "")
    .split(/(?<=[。！？\n])/)
    .filter((s) => s.trim() && !PSYCHOLOGY_IN_ACTION.test(s))
    .join("")
    .trim();
}

export function scanDialogueEntities(text, authorizedClueNames) {
  const authorized = new Set((authorizedClueNames || []).map((n) => n.replace(/\s/g, "")));
  const violations = [];
  const flat = String(text || "");
  for (const token of ["细线", "暗格", "走私", "机关", "钥匙胚", "旋转开关", "违规记录", "频率干扰"]) {
    if (!flat.includes(token)) continue;
    const ok = [...authorized].some((name) => name.includes(token.replace(/\s/g, "")) || token.includes(name));
    if (!ok) violations.push({ type: "unauthorizedEntity", token });
  }
  return { passed: violations.length === 0, violations };
}

export function scanPersonaBleed(text, roleKey, characterArchives) {
  const body = String(text || "");
  const violations = [];
  const markersByRole = {
    "role-1": [/送补给/, /工具箱.*钥匙胚/, /林师傅/],
    "role-2": [/气象记录员/, /气象日志/, /潮位表/],
    "role-3": [/检修电台/, /通讯室/, /信号线/],
    "role-4": [/遗嘱/, /律师/, /公文包/]
  };
  for (const [rk, patterns] of Object.entries(markersByRole)) {
    if (rk === roleKey) continue;
    for (const re of patterns) {
      if (re.test(body)) violations.push({ type: "personaBleed", fromRole: rk, pattern: re.source });
    }
  }
  const self = characterArchives?.roles?.find((r) => r.key === roleKey);
  const selfFirst = self?.name?.split("·")[0]?.trim();
  if (selfFirst && new RegExp(`看见${selfFirst}站在|${selfFirst}站在.*门口`).test(body)) {
    violations.push({ type: "selfObservation", match: selfFirst });
  }
  const seen = new Set();
  return {
    passed: violations.length === 0,
    violations: violations.filter((v) => {
      const k = `${v.type}:${v.pattern || v.match}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
  };
}

export function stitchStructuredScript({ actionLog, feelingsPack, dialogueLog }) {
  const parts = [];
  if (actionLog?.narrative) parts.push(actionLog.narrative);
  const feelingBlock = [...(feelingsPack?.puzzles || []), ...(feelingsPack?.emotions || [])].filter(Boolean);
  if (feelingBlock.length) parts.push(feelingBlock.join("\n"));
  if (dialogueLog?.narrative) parts.push(dialogueLog.narrative);
  return cleanText(parts.join("\n\n"), 12000);
}

export function applyStructuredGates({ actionLog, feelingsPack, dialogueLog, roleKey, characterArchives, infoMatrix, matrixRow, actKey, config }) {
  const authorized = buildAuthorizedClueNames(infoMatrix, matrixRow, actKey, config);
  let actionNarrative = stripPsychologyFromAction(actionLog.narrative);
  const actionPsych = scanActionLogPsychology(actionNarrative);
  const dialogueEnt = scanDialogueEntities(dialogueLog.narrative, authorized);
  const persona = scanPersonaBleed(
    `${actionNarrative}\n${dialogueLog.narrative}`,
    roleKey,
    characterArchives
  );
  const gates = {
    actionPsychology: actionPsych,
    dialogueEntities: dialogueEnt,
    personaBleed: persona,
    feelingsPack: { passed: true, count: (feelingsPack.puzzles?.length || 0) + (feelingsPack.emotions?.length || 0) }
  };
  const passed = actionPsych.passed && dialogueEnt.passed && persona.passed;
  return {
    passed,
    gates,
    actionLog: { ...actionLog, narrative: actionNarrative },
    feelingsPack,
    dialogueLog
  };
}
