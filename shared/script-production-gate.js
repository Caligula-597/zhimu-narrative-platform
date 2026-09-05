/**
 * P8.2.0 Script Production Gate — blockers vs fillable gaps vs advisories.
 * Writer must not invent OWNER / structure; may fill MISSING_CLUE_DETAIL.
 */

import { MASTER_DRAFT_WARNING_TYPES } from "./production-master-draft-contracts.js";

const BLOCKER_TYPES = new Set([
  "OWNER_UNRESOLVED",
  "OWNER_RESOLUTION_AMBIGUOUS",
  "UNRESOLVED_CONFLICT",
  "MISSING_CAUSAL_LINK",
]);

const FILLABLE_TYPES = new Set(["MISSING_CLUE_DETAIL"]);

const ADVISORY_TYPES = new Set([
  "STAGE_CROWDING",
  "LOW_WEAVE_DENSITY",
  "PARALLEL_HEAVY",
  "ROLE_OVERLOAD",
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function classifyWarning(w) {
  const type = String(w?.type || "");
  if (BLOCKER_TYPES.has(type)) return "blocker";
  if (FILLABLE_TYPES.has(type)) return "fillable";
  if (type === "NEEDS_DETAIL") {
    // Structural NEEDS_DETAIL on beats without goal/action is blocker-ish for production;
    // if already has actor/goal/action, treat as fillable prose gap.
    const msg = String(w?.message || "");
    if (/缺完整 actor|缺角色目标|OWNER|主导/.test(msg)) return "blocker";
    return "fillable";
  }
  if (ADVISORY_TYPES.has(type)) return "advisory";
  if (MASTER_DRAFT_WARNING_TYPES.includes(type)) return "advisory";
  return "advisory";
}

/**
 * @returns {{
 *   status: "READY" | "READY_WITH_WARNINGS" | "BLOCKED",
 *   blockers: object[],
 *   fillableGaps: object[],
 *   advisories: object[],
 * }}
 */
export function evaluateScriptProductionReadiness(pmd) {
  const warnings = asArray(pmd?.warnings);
  const blockers = [];
  const fillableGaps = [];
  const advisories = [];

  for (const w of warnings) {
    const bucket = classifyWarning(w);
    const row = {
      id: w.id,
      type: w.type,
      severity: w.severity,
      message: w.message,
      stageIds: w.stageIds || [],
      beatIds: w.beatIds || [],
    };
    if (bucket === "blocker") blockers.push(row);
    else if (bucket === "fillable") fillableGaps.push(row);
    else advisories.push(row);
  }

  // Hard structural: no stages / no characters
  if (!asArray(pmd?.stages).length) {
    blockers.push({
      id: "gate-no-stages",
      type: "NO_STAGES",
      severity: "error",
      message: "ProductionMasterDraft 无 stages，无法进入剧本生产",
      stageIds: [],
      beatIds: [],
    });
  }
  if (!asArray(pmd?.characterViews?.characters).length) {
    blockers.push({
      id: "gate-no-characters",
      type: "NO_CHARACTERS",
      severity: "error",
      message: "Character Views 为空，无法生成角色本",
      stageIds: [],
      beatIds: [],
    });
  }

  let status = "READY";
  if (blockers.length) status = "BLOCKED";
  else if (fillableGaps.length || advisories.length) status = "READY_WITH_WARNINGS";

  return { status, blockers, fillableGaps, advisories };
}

export const SCRIPT_PRODUCTION_BLOCKER_TYPES = Object.freeze([...BLOCKER_TYPES]);
export const SCRIPT_PRODUCTION_FILLABLE_TYPES = Object.freeze([...FILLABLE_TYPES]);
