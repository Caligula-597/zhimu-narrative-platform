/**
 * Post-generation quality gates — mechanical, non-LLM.
 * Runs after each script cell before continuing the waterfall.
 */
import { actIndex } from "./prompts/matrix-prompt-engine.js";
import { cleanText } from "./prompts/shared.js";
import { scanKillerSpoilers, tokensFromForbiddenFact } from "./pipeline-matrix-killer-guard.js";

const DISCOVERY_VERBS = /(?:发现|看到|看见|捡到|捡起|拾起|打开|读到|翻出|找到|抽出|掏出|核对|确认|翻阅)/;
const GUILT_PATTERNS = [
  /必须隐瞒/,
  /(?:我|你).{0,6}(?:杀了|杀害|灭口|谋杀|害死)/,
  /(?:是我|凶手就是我)/,
  /(?:心里清楚|我知道).{0,12}(?:杀人|作案|走私|改频)/,
  /走私记录.{0,12}(?:圆|毁|藏|祈祷)/,
  /(?:设置|做了).{0,8}机关/,
  /(?:威胁.{0,8}上报|举报我)/
];

function normalize(text) {
  return String(text || "").replace(/\s+/g, "");
}

/** Clue names this role may reference by direct discovery in this act and prior acts. */
export function buildAuthorizedClueNames(infoMatrix, matrixRow, actKey, config) {
  const keys = config?.chapterKeys || [];
  const actIdx = actIndex(config, actKey);
  const authorizedIds = new Set();
  for (const row of infoMatrix?.rows || []) {
    if (row.roleKey !== matrixRow?.roleKey) continue;
    const rowIdx = keys.indexOf(row.actKey);
    if (rowIdx < 0 || rowIdx > actIdx) continue;
    for (const id of row.newClueIds || []) authorizedIds.add(id);
  }
  const names = new Set();
  for (const clue of infoMatrix?.clues || []) {
    const clueIdx = keys.indexOf(clue.actKey);
    if (clueIdx < 0 || clueIdx > actIdx) continue;
    if (authorizedIds.has(clue.key) || clue.grantMode === "auto") {
      if (clue.name) names.add(clue.name);
    }
  }
  return [...names];
}

/**
 * Scan sentences for unauthorized physical discoveries of host_confirm clues.
 */
export function scanUnauthorizedDiscoveries(body, infoMatrix, matrixRow, actKey, config) {
  const authorized = new Set(buildAuthorizedClueNames(infoMatrix, matrixRow, actKey, config).map(normalize));
  const violations = [];
  const sentences = String(body || "").split(/(?<=[。！？\n])/);

  for (const clue of infoMatrix?.clues || []) {
    const name = clue.name;
    if (!name || name.length < 2) continue;
    if (authorized.has(normalize(name))) continue;
    if (clue.grantMode !== "host_confirm") continue;
    for (const sentence of sentences) {
      if (!sentence.includes(name)) continue;
      if (DISCOVERY_VERBS.test(sentence)) {
        violations.push({ type: "unauthorizedDiscovery", clueName: name, sentence: sentence.trim().slice(0, 120) });
      }
    }
  }
  const seen = new Set();
  return {
    passed: violations.length === 0,
    violations: violations.filter((v) => {
      const key = `${v.clueName}:${v.sentence.slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  };
}

export function scanForbiddenFacts(body, spoilerContract) {
  const flat = normalize(body);
  const violations = [];
  for (const fact of spoilerContract?.forbiddenFacts || []) {
    for (const token of tokensFromForbiddenFact(fact)) {
      if (token.length >= 2 && flat.includes(token)) {
        violations.push({ type: "forbiddenFact", match: token, fact });
      }
    }
  }
  const seen = new Set();
  const deduped = violations.filter((v) => {
    const key = `${v.type}:${v.match}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { passed: deduped.length === 0, violations: deduped };
}

export function scanGuiltStatements(body) {
  const raw = String(body || "");
  const matches = [];
  for (const re of GUILT_PATTERNS) {
    const m = raw.match(re);
    if (m) matches.push({ type: "guiltStatement", match: m[0] });
  }
  return { passed: matches.length <= 2, count: matches.length, violations: matches };
}

const VAGUE_REPLACEMENT = "你注意到那个角落，但光线太暗，什么也看不清。";

export function stripUnauthorizedDiscoveries(body, violations) {
  let text = String(body || "");
  for (const v of violations || []) {
    if (v.type !== "unauthorizedDiscovery" || !v.sentence) continue;
    const escaped = v.sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped);
    if (re.test(text)) {
      text = text.replace(re, VAGUE_REPLACEMENT);
    } else if (v.clueName) {
      const parts = text.split(/(?<=[。！？\n])/);
      text = parts
        .map((s) => (s.includes(v.clueName) && DISCOVERY_VERBS.test(s) ? VAGUE_REPLACEMENT : s))
        .join("");
    }
  }
  return cleanText(text, 12000);
}

export function applyScriptQualityGates(body, {
  spoilerContract,
  infoMatrix,
  matrixRow,
  actKey,
  config,
  isKillerInnocentMode = false,
  actIndex: actIdx,
  isKiller,
  finalActIndex
}) {
  const gates = {};

  gates.forbiddenFacts = scanForbiddenFacts(body, spoilerContract);
  gates.unauthorizedDiscovery = scanUnauthorizedDiscoveries(body, infoMatrix, matrixRow, actKey, config);
  if (!gates.unauthorizedDiscovery.passed) {
    body = stripUnauthorizedDiscoveries(body, gates.unauthorizedDiscovery.violations);
    gates.unauthorizedDiscovery = scanUnauthorizedDiscoveries(body, infoMatrix, matrixRow, actKey, config);
  }

  if (isKiller && isKillerInnocentMode && actIdx < finalActIndex) {
    gates.guiltStatements = scanGuiltStatements(body);
    gates.killerSpoilers = { passed: true, violations: [] };
  } else if (isKiller && actIdx < finalActIndex) {
    gates.killerSpoilers = scanKillerSpoilers(body, {
      spoilerContract,
      actIndex: actIdx,
      isKiller: true,
      finalActIndex
    });
  } else {
    gates.killerSpoilers = { passed: true, violations: [] };
  }

  const passed =
    gates.forbiddenFacts.passed &&
    gates.unauthorizedDiscovery.passed &&
    (gates.guiltStatements ? gates.guiltStatements.passed : true) &&
    gates.killerSpoilers.passed;

  return { body, gates, passed };
}
