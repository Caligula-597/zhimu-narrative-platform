/**
 * P7.2 Playable Mechanism Runtime Bridge (+ P7.2.5 hardening)
 *
 * Layer: Placement ↔ existing GAME template engine ↔ OutcomeBinding ↔ Effect Executor.
 * Must NOT write permissionGrants / keyStates directly — only via applyRuntimeEffects.
 */

import {
  initMechanismState,
  instantiateMechanism,
  runMechanismAction,
  settleMechanism,
} from "./mechanism-templates.js";
import { runBaseFlow } from "./mechanism-base-templates.js";
import {
  PlayableContentRuntimeError,
  normalizePlayableRuntimeState,
} from "./playable-content-runtime.js";
import { applyRuntimeEffects, selectOutcomeBinding } from "./playable-runtime-effects.js";
import { canonicalPlayableErrorCode } from "./playable-runtime-errors.js";
import {
  assertMechanismTransition,
  normalizeMechanismExecution,
} from "./playable-mechanism-execution.js";

function fail(code, message, details) {
  throw new PlayableContentRuntimeError(canonicalPlayableErrorCode(code), message, details);
}

function nowIso(now) {
  return typeof now === "function" ? now() : now || new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function playerRoleIds(snapshot) {
  return (snapshot.roles || []).filter((r) => r.type === "PLAYER").map((r) => r.id);
}

function getPlacement(snapshot, placementId) {
  return (snapshot.mechanismPlacements || []).find((p) => p.id === placementId) || null;
}

function requireRunning(state) {
  if (!state) fail("RUNTIME_MISSING", "No runtime");
  if (state.status !== "RUNNING") fail("NOT_RUNNING", `Runtime status is ${state.status}`);
  return state;
}

function upsertPlacementStatus(state, placementId, patch) {
  const list = asArray(state.placementStatuses);
  const idx = list.findIndex((p) => p.placementId === placementId);
  const next = { placementId, status: patch.status, note: patch.note };
  if (idx < 0) return [...list, next];
  const copy = [...list];
  copy[idx] = { ...copy[idx], ...next };
  return copy;
}

function executionMap(state) {
  const src = state.mechanismExecutions;
  if (src && typeof src === "object" && !Array.isArray(src)) return { ...src };
  return {};
}

export function startPlacementMechanism(runtime, { placementId, now } = {}) {
  const state = requireRunning(normalizePlayableRuntimeState(runtime));
  const placement = getPlacement(state.playableSnapshot, placementId);
  if (!placement) fail("UNKNOWN_PLACEMENT", `Unknown placement ${placementId}`);
  if (placement.stageId !== state.currentStageId) {
    fail("NOT_CURRENT_STAGE", `Placement ${placementId} is not on active stage`);
  }
  if (placement.familyId === "M09" || placement.mechanismTemplateId?.startsWith("M09")) {
    fail("MECHANISM_NOT_IMPLEMENTED", "M09 is not executable in P7.2");
  }
  if (placement.mechanismTemplateId !== "M03-1" && placement.familyId !== "M03") {
    fail("MECHANISM_UNSUPPORTED", `Bridge only supports M03-1, got ${placement.mechanismTemplateId}`);
  }

  const executions = executionMap(state);
  const existing = executions[placementId]
    ? normalizeMechanismExecution(executions[placementId], placementId)
    : null;

  if (existing?.status === "SETTLED") {
    fail("ALREADY_SETTLED", `Placement ${placementId} already settled`);
  }
  if (existing?.status === "RUNNING" && existing.runtimeInstanceId) {
    return normalizePlayableRuntimeState(state);
  }

  assertMechanismTransition(existing?.status || "READY", "RUNNING");

  const roles = playerRoleIds(state.playableSnapshot);
  const assigned = state.roleAssignments.map((a) => a.playableRoleId);
  for (const rid of roles) {
    if (!assigned.includes(rid)) {
      fail("UNASSIGNED_ROLES", `Missing assignment for ${rid}`, { roleId: rid });
    }
  }

  const ts = nowIso(now);
  const templateId = placement.mechanismTemplateId || "M03-1";
  const instance = instantiateMechanism(templateId, {
    start_price: 2,
    min_increment: 1,
    extend_to: 15,
    freeze_asset: "currency",
    lot: "storage_room_access",
    ...(placement.runtimeConfig || {}),
  });
  let gameState = initMechanismState(templateId, {
    players: roles,
    capacity: { currency: 100 },
  });
  for (const rid of roles) {
    gameState = {
      ...gameState,
      players: {
        ...gameState.players,
        [rid]: {
          ...gameState.players[rid],
          resources: { ...(gameState.players[rid]?.resources || {}), currency: 100 },
        },
      },
    };
  }
  gameState = runBaseFlow("TIMER", "start", gameState, instance.baseParams.TIMER, {
    clockKey: "main",
    duration: Number(instance.params.base_duration) || 480,
  });

  const runtimeInstanceId = `mech_${placementId}_${ts.replace(/[:.]/g, "")}`;
  executions[placementId] = normalizeMechanismExecution(
    {
      placementId,
      status: "RUNNING",
      runtimeInstanceId,
      templateId,
      instance,
      gameState,
      outcomeId: null,
      winnerRoleId: null,
      settledAt: null,
      appliedEffectIds: [],
      startedAt: ts,
    },
    placementId,
  );

  return normalizePlayableRuntimeState({
    ...state,
    mechanismExecutions: executions,
    placementStatuses: upsertPlacementStatus(state, placementId, {
      status: "RUNNING",
      note: "竞价进行中",
    }),
    updatedAt: ts,
    revision: state.revision + 1,
  });
}

export function bidPlacementMechanism(runtime, { placementId, playableRoleId, amount, bidId, now } = {}) {
  const state = requireRunning(normalizePlayableRuntimeState(runtime));
  const executions = executionMap(state);
  const exec = executions[placementId]
    ? normalizeMechanismExecution(executions[placementId], placementId)
    : null;
  if (!exec || exec.status !== "RUNNING") {
    fail("MECHANISM_NOT_RUNNING", `Placement ${placementId} is not running`);
  }
  if (!playableRoleId) fail("ROLE_REQUIRED", "playableRoleId required");
  const templateId = exec.templateId || "M03-1";
  const nextGame = runMechanismAction(templateId, "bid", exec.gameState, exec.instance, {
    player: playableRoleId,
    amount: Number(amount),
    bidId: bidId || `bid_${playableRoleId}_${Date.now()}`,
  });
  executions[placementId] = { ...exec, gameState: nextGame };
  return normalizePlayableRuntimeState({
    ...state,
    mechanismExecutions: executions,
    updatedAt: nowIso(now),
    revision: state.revision + 1,
  });
}

export function settlePlacementMechanism(runtime, { placementId, now } = {}) {
  const state = requireRunning(normalizePlayableRuntimeState(runtime));
  const placement = getPlacement(state.playableSnapshot, placementId);
  if (!placement) fail("UNKNOWN_PLACEMENT", `Unknown placement ${placementId}`);

  const executions = executionMap(state);
  const exec = executions[placementId]
    ? normalizeMechanismExecution(executions[placementId], placementId)
    : null;
  if (!exec) fail("MECHANISM_NOT_STARTED", `Placement ${placementId} was never started`);

  if (exec.status === "SETTLED") {
    return normalizePlayableRuntimeState(state);
  }
  if (exec.status !== "RUNNING") {
    fail("MECHANISM_NOT_RUNNING", `Placement ${placementId} is not running`);
  }

  assertMechanismTransition("RUNNING", "SETTLED");

  const templateId = exec.templateId || "M03-1";
  const settledGame = settleMechanism(templateId, exec.gameState, exec.instance);
  const result = settledGame.mechanism?.result || {};
  if (result.status !== "SOLD" || !result.winner) {
    fail("MECHANISM_NO_WINNER", "Auction did not produce a winner", { result });
  }

  const winnerRoleId = String(result.winner);
  const { binding, outcomeIndex } = selectOutcomeBinding(placement, result);
  if (!binding) {
    fail("OUTCOME_BINDING_MISSING", `No WINNER outcomeBinding for ${placementId}`);
  }

  const outcomeId = `outcome_${placementId}_${outcomeIndex}_WINNER`;
  const ts = nowIso(now);
  // Effect Executor is the only writer of permissionGrants / keyStates
  let next = applyRuntimeEffects(state, {
    effects: binding.effects,
    placementId,
    outcomeId,
    outcomeIndex,
    winnerRoleId,
    now: () => ts,
  });

  const appliedIds = asArray(binding.effects).map((_, i) => `${outcomeId}#${i}`);
  executions[placementId] = normalizeMechanismExecution(
    {
      ...exec,
      status: "SETTLED",
      gameState: settledGame,
      outcomeId,
      winnerRoleId,
      settledAt: ts,
      appliedEffectIds: appliedIds,
      result,
    },
    placementId,
  );

  const winnerName =
    (state.playableSnapshot.roles || []).find((r) => r.id === winnerRoleId)?.name || winnerRoleId;

  next = {
    ...next,
    mechanismExecutions: executions,
    placementStatuses: upsertPlacementStatus(next, placementId, {
      status: "SETTLED",
      note: `已结算 · 赢家 ${winnerName}`,
    }),
    updatedAt: ts,
    revision: state.revision + 1,
  };

  return normalizePlayableRuntimeState(next);
}

export function getPlacementExecution(runtime, placementId) {
  const state = normalizePlayableRuntimeState(runtime);
  const raw = executionMap(state)[placementId];
  return raw ? normalizeMechanismExecution(raw, placementId) : null;
}
