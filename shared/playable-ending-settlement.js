/**
 * P7.3 Playable Ending Settlement
 *
 * Separates M09 vote result ("who was accused") from session lifecycle FINISHED.
 * Does not write permission/keyStates — Effect Executor owns those.
 */

import { canonicalPlayableErrorCode } from "./playable-runtime-errors.js";

export const ENDING_SETTLEMENT_STATUSES = Object.freeze([
  "PENDING_CONFIRMATION",
  "CONFIRMED",
]);

function fail(code, message, details) {
  const err = new Error(message);
  err.name = "PlayableContentRuntimeError";
  err.code = canonicalPlayableErrorCode(code);
  err.details = details || {};
  throw err;
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nowIso(now) {
  return typeof now === "function" ? now() : now || new Date().toISOString();
}

function roleName(snapshot, roleId) {
  return (snapshot?.roles || []).find((r) => r.id === roleId)?.name || roleId;
}

export function normalizeEndingSettlement(value = {}) {
  const src = record(value);
  const status = ENDING_SETTLEMENT_STATUSES.includes(src.status)
    ? src.status
    : "PENDING_CONFIRMATION";
  const result = record(src.result);
  return {
    id: String(src.id || ""),
    roomId: src.roomId != null ? String(src.roomId) : null,
    sourcePlacementId: String(src.sourcePlacementId || ""),
    sourceMechanismInstanceId:
      src.sourceMechanismInstanceId != null ? String(src.sourceMechanismInstanceId) : null,
    status,
    result: {
      outcomeId: result.outcomeId != null ? String(result.outcomeId) : null,
      outcomeType: result.outcomeType != null ? String(result.outcomeType) : null,
      winningOptionId: result.winningOptionId != null ? String(result.winningOptionId) : null,
      winningRoleId: result.winningRoleId != null ? String(result.winningRoleId) : null,
      correctOptionId: result.correctOptionId != null ? String(result.correctOptionId) : null,
      isCorrect: result.isCorrect == null ? null : Boolean(result.isCorrect),
      voteSummary: result.voteSummary && typeof result.voteSummary === "object" ? result.voteSummary : null,
      tiedOptionIds: asArray(result.tiedOptionIds).map(String),
    },
    effectApplicationIds: asArray(src.effectApplicationIds).map(String),
    publicSummary: src.publicSummary != null ? String(src.publicSummary) : "",
    hostSummary: src.hostSummary != null ? String(src.hostSummary) : "",
    settledAt: src.settledAt != null ? String(src.settledAt) : null,
    confirmedAt: src.confirmedAt != null ? String(src.confirmedAt) : null,
  };
}

/**
 * Deterministic ending text — no LLM.
 */
export function renderEndingPublicSummary({
  snapshot,
  winningOptionId,
  correctOptionId,
  isCorrect,
  outcomeType,
  tiedOptionIds = [],
} = {}) {
  if (outcomeType === "TIE") {
    const names = tiedOptionIds.map((id) => roleName(snapshot, id)).join("、");
    return `票数相同（${names || "并列"}），无法形成唯一指认。`;
  }
  if (outcomeType === "NO_DECISION") {
    return "有效票不足，未能形成指认结果。";
  }
  const accused = winningOptionId ? roleName(snapshot, winningOptionId) : null;
  if (!accused) return "最终指认已结算。";
  let text = `最终多数指认：${accused}。`;
  if (correctOptionId && isCorrect === true) text += "指认正确。";
  if (correctOptionId && isCorrect === false) {
    text += `最终指认错误，真正的凶手是 ${roleName(snapshot, correctOptionId)}。`;
  }
  return text;
}

export function buildEndingSettlementFromVote({
  roomId,
  placement,
  execution,
  settlementResult,
  outcomeId,
  effectApplicationIds = [],
  snapshot,
  now,
} = {}) {
  const ts = nowIso(now);
  const cfg = record(placement?.runtimeConfig);
  const correctOptionId = cfg.correctOptionId ? String(cfg.correctOptionId) : null;
  const outcomeType = String(settlementResult?.status || "UNKNOWN");
  const winningOptionId =
    outcomeType === "DECIDED" && settlementResult?.winner
      ? String(settlementResult.winner)
      : null;
  const isCorrect =
    correctOptionId && winningOptionId ? winningOptionId === correctOptionId : null;
  const tiedOptionIds = asArray(settlementResult?.tied).map(String);
  const publicSummary = renderEndingPublicSummary({
    snapshot,
    winningOptionId,
    correctOptionId,
    isCorrect,
    outcomeType,
    tiedOptionIds,
  });
  const counts = record(settlementResult?.counts);
  const voteLines = Object.entries(counts)
    .map(([id, n]) => `${roleName(snapshot, id)}：${n}`)
    .join("；");

  return normalizeEndingSettlement({
    id: `ending_${placement?.id || "unknown"}_${ts.replace(/[:.]/g, "")}`,
    roomId,
    sourcePlacementId: placement?.id,
    sourceMechanismInstanceId: execution?.runtimeInstanceId,
    status: "PENDING_CONFIRMATION",
    result: {
      outcomeId,
      outcomeType,
      winningOptionId,
      winningRoleId: winningOptionId,
      correctOptionId,
      isCorrect,
      voteSummary: {
        counts,
        abstain: settlementResult?.abstain ?? 0,
        valid: settlementResult?.valid ?? 0,
        lines: voteLines,
      },
      tiedOptionIds,
    },
    effectApplicationIds,
    publicSummary,
    hostSummary: voteLines ? `${publicSummary} 票数：${voteLines}` : publicSummary,
    settledAt: ts,
    confirmedAt: null,
  });
}

export function requiredPlacementsForCompletion(snapshot, stageId) {
  return (snapshot?.mechanismPlacements || []).filter((p) => {
    if (stageId && p.stageId !== stageId) return false;
    if (p.requiredForStageCompletion === true) return true;
    // Final-stage M09 placements default to required
    const isM09 = p.familyId === "M09" || String(p.mechanismTemplateId || "").startsWith("M09");
    const stages = snapshot?.stages || [];
    const finalId = snapshot?.runtimeConfig?.finalStageId || stages[stages.length - 1]?.id;
    return isM09 && p.stageId === finalId;
  });
}

/**
 * Thin guard — not a full rule engine.
 */
export function canFinishPlayableSession(runtime) {
  const state = runtime;
  if (!state || state.status !== "RUNNING") {
    return { ok: false, code: "NOT_RUNNING", reason: "Session not running" };
  }
  const snapshot = state.playableSnapshot;
  const stages = snapshot?.stages || [];
  const finalId = snapshot?.runtimeConfig?.finalStageId || stages[stages.length - 1]?.id;
  if (state.currentStageId !== finalId) {
    return { ok: false, code: "NOT_CURRENT_STAGE", reason: "Not on final stage" };
  }
  const required = requiredPlacementsForCompletion(snapshot, state.currentStageId);
  for (const p of required) {
    const exec = state.mechanismExecutions?.[p.id];
    if (!exec || exec.status !== "SETTLED") {
      return {
        ok: false,
        code: "NOT_READY_TO_SETTLE",
        reason: `Required placement ${p.id} not settled`,
        placementId: p.id,
      };
    }
  }
  const ending = state.endingSettlement
    ? normalizeEndingSettlement(state.endingSettlement)
    : null;
  if (!ending) {
    return { ok: false, code: "ENDING_MISSING", reason: "Ending settlement missing" };
  }
  if (ending.status === "CONFIRMED") {
    return { ok: false, code: "ENDING_ALREADY_CONFIRMED", reason: "Ending already confirmed" };
  }
  if (ending.status !== "PENDING_CONFIRMATION") {
    return { ok: false, code: "NOT_READY_TO_SETTLE", reason: "Ending not pending confirmation" };
  }
  return { ok: true, code: "OK", ending };
}

export function assertCanFinishPlayableSession(runtime) {
  const gate = canFinishPlayableSession(runtime);
  if (!gate.ok) fail(gate.code, gate.reason, { placementId: gate.placementId });
  return gate;
}

export function buildEndingSnapshot(runtime, { ending, now } = {}) {
  const state = runtime;
  const ts = nowIso(now);
  const execSummary = {};
  for (const [pid, raw] of Object.entries(record(state.mechanismExecutions))) {
    execSummary[pid] = {
      status: raw?.status,
      outcomeId: raw?.outcomeId,
      winnerRoleId: raw?.winnerRoleId,
      result: raw?.result || null,
      settledAt: raw?.settledAt || null,
    };
  }
  return {
    capturedAt: ts,
    status: "FINISHED",
    currentStageId: state.currentStageId,
    roleAssignments: asArray(state.roleAssignments),
    releasedClueIds: asArray(state.releasedClueIds),
    releasedContentUnitIds: asArray(state.releasedContentUnitIds),
    permissionGrants: asArray(state.permissionGrants),
    keyStates: { ...record(state.keyStates) },
    mechanismExecutions: execSummary,
    endingSettlement: ending ? normalizeEndingSettlement(ending) : null,
    startedAt: state.startedAt,
    finishedAt: ts,
  };
}
