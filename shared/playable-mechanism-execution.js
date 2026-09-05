/**
 * P7.2.5 — MechanismExecution state machine (placement lifecycle).
 *
 * Allowed:
 *   READY → RUNNING → SETTLED
 * Forbidden:
 *   SETTLED → RUNNING
 *   READY → SETTLED (no fast-settle in V1)
 */

import { canonicalPlayableErrorCode } from "./playable-runtime-errors.js";

export const MECHANISM_EXECUTION_STATUSES = Object.freeze(["READY", "RUNNING", "SETTLED"]);

const ALLOWED = Object.freeze({
  READY: Object.freeze(["RUNNING"]),
  RUNNING: Object.freeze(["SETTLED"]),
  SETTLED: Object.freeze([]),
});

export function normalizeMechanismExecution(value = {}, placementId = "") {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const status = MECHANISM_EXECUTION_STATUSES.includes(src.status) ? src.status : "READY";
  return {
    placementId: String(src.placementId || placementId || ""),
    status,
    runtimeInstanceId: src.runtimeInstanceId != null ? String(src.runtimeInstanceId) : null,
    templateId: src.templateId != null ? String(src.templateId) : null,
    instance: src.instance ?? null,
    gameState: src.gameState ?? null,
    outcomeId: src.outcomeId != null ? String(src.outcomeId) : null,
    winnerRoleId: src.winnerRoleId != null ? String(src.winnerRoleId) : null,
    settledAt: src.settledAt != null ? String(src.settledAt) : null,
    startedAt: src.startedAt != null ? String(src.startedAt) : null,
    appliedEffectIds: Array.isArray(src.appliedEffectIds) ? src.appliedEffectIds.map(String) : [],
    result: src.result && typeof src.result === "object" ? src.result : null,
  };
}

export function assertMechanismTransition(fromStatus, toStatus) {
  const from = MECHANISM_EXECUTION_STATUSES.includes(fromStatus) ? fromStatus : null;
  const to = MECHANISM_EXECUTION_STATUSES.includes(toStatus) ? toStatus : null;
  if (!from || !to) {
    const err = new Error(`Invalid mechanism status ${fromStatus} → ${toStatus}`);
    err.code = canonicalPlayableErrorCode("INVALID_TRANSITION");
    throw err;
  }
  if (from === to) return; // idempotent same-state
  if (!(ALLOWED[from] || []).includes(to)) {
    const err = new Error(`Illegal mechanism transition ${from} → ${to}`);
    err.code = canonicalPlayableErrorCode("INVALID_TRANSITION");
    err.details = { from, to };
    throw err;
  }
}

export function canStartMechanismExecution(exec) {
  if (!exec) return true; // first start implies READY
  return exec.status === "READY" || (!exec.runtimeInstanceId && exec.status !== "SETTLED" && exec.status !== "RUNNING");
}

export function canSettleMechanismExecution(exec) {
  return Boolean(exec && exec.status === "RUNNING");
}
