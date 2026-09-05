/**
 * P7.2 / P7.3 Playable Mechanism Runtime Bridge
 *
 * Layer: Placement ↔ existing GAME template engine ↔ OutcomeBinding ↔ Effect Executor.
 * Must NOT write permissionGrants / keyStates directly — only via applyRuntimeEffects.
 * M09 uses the same READY → RUNNING → SETTLED FSM as M03.
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
import { buildEndingSettlementFromVote } from "./playable-ending-settlement.js";

function fail(code, message, details) {
  throw new PlayableContentRuntimeError(canonicalPlayableErrorCode(code), message, details);
}

function nowIso(now) {
  return typeof now === "function" ? now() : now || new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function playerRoleIds(snapshot) {
  return (snapshot.roles || []).filter((r) => r.type === "PLAYER").map((r) => r.id);
}

function getPlacement(snapshot, placementId) {
  return (snapshot.mechanismPlacements || []).find((p) => p.id === placementId) || null;
}

function isM03(placement) {
  return placement?.familyId === "M03" || String(placement?.mechanismTemplateId || "").startsWith("M03");
}

function isM09(placement) {
  return placement?.familyId === "M09" || String(placement?.mechanismTemplateId || "").startsWith("M09");
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

function mapGameError(error) {
  const code = String(error?.code || "");
  if (code === "BASE_INVALID_BALLOT") {
    fail("INVALID_OPTION", error.message || "Invalid option", error.details);
  }
  if (code === "BASE_TARGET_UNKNOWN") {
    fail("NOT_PARTICIPANT", error.message || "Not a participant", error.details);
  }
  if (code === "BASE_ALREADY_LOCKED") {
    fail("ALREADY_SETTLED", error.message || "Ballot locked", error.details);
  }
  if (code === "BASE_RULE_VIOLATION") {
    fail("ALREADY_SUBMITTED", error.message || "Revise locked", error.details);
  }
  throw error;
}

function ensureAssignedPlayers(state) {
  const roles = playerRoleIds(state.playableSnapshot);
  const assigned = state.roleAssignments.map((a) => a.playableRoleId);
  for (const rid of roles) {
    if (!assigned.includes(rid)) {
      fail("UNASSIGNED_ROLES", `Missing assignment for ${rid}`, { roleId: rid });
    }
  }
  return roles;
}

function startM03(state, placement, { now } = {}) {
  const ts = nowIso(now);
  const roles = ensureAssignedPlayers(state);
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

  const runtimeInstanceId = `mech_${placement.id}_${ts.replace(/[:.]/g, "")}`;
  const executions = executionMap(state);
  executions[placement.id] = normalizeMechanismExecution(
    {
      placementId: placement.id,
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
    placement.id,
  );

  return normalizePlayableRuntimeState({
    ...state,
    mechanismExecutions: executions,
    placementStatuses: upsertPlacementStatus(state, placement.id, {
      status: "RUNNING",
      note: "竞价进行中",
    }),
    updatedAt: ts,
    revision: state.revision + 1,
  });
}

function startM09(state, placement, { now } = {}) {
  const ts = nowIso(now);
  const roles = ensureAssignedPlayers(state);
  const templateId = placement.mechanismTemplateId || "M09-1";
  const cfg = record(placement.runtimeConfig);
  const candidates = asArray(cfg.candidates).length
    ? asArray(cfg.candidates).map(String)
    : roles;
  const instance = instantiateMechanism(templateId, {
    candidates,
    submit_seconds: Number(cfg.submit_seconds) || 600,
    tie_exit: cfg.tie_exit || "KEEP_ALL",
    ...cfg,
    candidates,
  });
  let gameState = initMechanismState(templateId, { players: roles });
  gameState = runBaseFlow("TIMER", "start", gameState, instance.baseParams.TIMER, {
    clockKey: "main",
    duration: Number(instance.params.submit_seconds) || 600,
  });

  const runtimeInstanceId = `mech_${placement.id}_${ts.replace(/[:.]/g, "")}`;
  const executions = executionMap(state);
  executions[placement.id] = normalizeMechanismExecution(
    {
      placementId: placement.id,
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
    placement.id,
  );

  return normalizePlayableRuntimeState({
    ...state,
    mechanismExecutions: executions,
    placementStatuses: upsertPlacementStatus(state, placement.id, {
      status: "RUNNING",
      note: "最终指认进行中",
    }),
    updatedAt: ts,
    revision: state.revision + 1,
  });
}

export function startPlacementMechanism(runtime, { placementId, now } = {}) {
  const state = requireRunning(normalizePlayableRuntimeState(runtime));
  const placement = getPlacement(state.playableSnapshot, placementId);
  if (!placement) fail("UNKNOWN_PLACEMENT", `Unknown placement ${placementId}`);
  if (placement.stageId !== state.currentStageId) {
    fail("NOT_CURRENT_STAGE", `Placement ${placementId} is not on active stage`);
  }
  if (!isM03(placement) && !isM09(placement)) {
    fail("MECHANISM_UNSUPPORTED", `Bridge only supports M03/M09, got ${placement.mechanismTemplateId}`);
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

  if (isM09(placement)) return startM09(state, placement, { now });
  return startM03(state, placement, { now });
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
  if (!String(templateId).startsWith("M03")) {
    fail("MECHANISM_UNSUPPORTED", "bid only applies to M03 placements");
  }
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

export function votePlacementMechanism(runtime, {
  placementId,
  playableRoleId,
  optionId,
  now,
} = {}) {
  const state = requireRunning(normalizePlayableRuntimeState(runtime));
  const placement = getPlacement(state.playableSnapshot, placementId);
  if (!placement) fail("UNKNOWN_PLACEMENT", `Unknown placement ${placementId}`);
  if (!isM09(placement)) {
    fail("MECHANISM_UNSUPPORTED", "vote only applies to M09 placements");
  }
  if (!playableRoleId) fail("ROLE_REQUIRED", "playableRoleId required");

  const assigned = state.roleAssignments.some((a) => a.playableRoleId === playableRoleId);
  if (!assigned) fail("ROLE_NOT_ASSIGNED", `Role ${playableRoleId} not assigned`);

  const participantRoles = playerRoleIds(state.playableSnapshot);
  if (!participantRoles.includes(playableRoleId)) {
    fail("NOT_PARTICIPANT", `Role ${playableRoleId} is not a vote participant`);
  }

  const executions = executionMap(state);
  const exec = executions[placementId]
    ? normalizeMechanismExecution(executions[placementId], placementId)
    : null;
  if (!exec || exec.status !== "RUNNING") {
    fail("MECHANISM_NOT_RUNNING", `Placement ${placementId} is not running`);
  }
  if (exec.status === "SETTLED") {
    fail("ALREADY_SETTLED", `Placement ${placementId} already settled`);
  }

  const choice = String(optionId || "");
  if (!choice) fail("INVALID_OPTION", "optionId required");

  const templateId = exec.templateId || "M09-1";
  let nextGame;
  try {
    nextGame = runMechanismAction(templateId, "vote", exec.gameState, exec.instance, {
      player: playableRoleId,
      choice,
    });
  } catch (error) {
    mapGameError(error);
  }

  executions[placementId] = { ...exec, gameState: nextGame };
  return normalizePlayableRuntimeState({
    ...state,
    mechanismExecutions: executions,
    updatedAt: nowIso(now),
    revision: state.revision + 1,
  });
}

function settleM03(state, placement, exec, { now } = {}) {
  const templateId = exec.templateId || "M03-1";
  const settledGame = settleMechanism(templateId, exec.gameState, exec.instance);
  const result = settledGame.mechanism?.result || {};
  if (result.status !== "SOLD" || !result.winner) {
    fail("MECHANISM_NO_WINNER", "Auction did not produce a winner", { result });
  }

  const winnerRoleId = String(result.winner);
  const { binding, outcomeIndex } = selectOutcomeBinding(placement, result);
  if (!binding) {
    fail("OUTCOME_BINDING_MISSING", `No WINNER outcomeBinding for ${placement.id}`);
  }

  const outcomeId = `outcome_${placement.id}_${outcomeIndex}_WINNER`;
  const ts = nowIso(now);
  let next = applyRuntimeEffects(state, {
    effects: binding.effects,
    placementId: placement.id,
    outcomeId,
    outcomeIndex,
    winnerRoleId,
    now: () => ts,
  });

  const appliedIds = asArray(binding.effects).map((_, i) => `${outcomeId}#${i}`);
  const executions = executionMap(next);
  executions[placement.id] = normalizeMechanismExecution(
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
    placement.id,
  );

  const winnerName =
    (state.playableSnapshot.roles || []).find((r) => r.id === winnerRoleId)?.name || winnerRoleId;

  return normalizePlayableRuntimeState({
    ...next,
    mechanismExecutions: executions,
    placementStatuses: upsertPlacementStatus(next, placement.id, {
      status: "SETTLED",
      note: `已结算 · 赢家 ${winnerName}`,
    }),
    updatedAt: ts,
    revision: state.revision + 1,
  });
}

function settleM09(state, placement, exec, { now } = {}) {
  const templateId = exec.templateId || "M09-1";
  const settledGame = settleMechanism(templateId, exec.gameState, exec.instance);
  const result = settledGame.mechanism?.result || {};
  const { binding, outcomeIndex } = selectOutcomeBinding(placement, result);
  if (!binding) {
    fail("OUTCOME_BINDING_MISSING", `No outcomeBinding for ${placement.id} status ${result.status}`);
  }

  const matcherType = String(binding.outcomeMatcher?.type || result.status || "OUTCOME");
  const outcomeId = `outcome_${placement.id}_${outcomeIndex}_${matcherType}`;
  const winningOptionId = result.winner ? String(result.winner) : null;
  const ts = nowIso(now);

  let next = applyRuntimeEffects(state, {
    effects: binding.effects,
    placementId: placement.id,
    outcomeId,
    outcomeIndex,
    winnerRoleId: winningOptionId,
    now: () => ts,
  });

  const appliedIds = asArray(binding.effects).map((_, i) => `${outcomeId}#${i}`);
  const executions = executionMap(next);
  executions[placement.id] = normalizeMechanismExecution(
    {
      ...exec,
      status: "SETTLED",
      gameState: settledGame,
      outcomeId,
      winnerRoleId: winningOptionId,
      settledAt: ts,
      appliedEffectIds: appliedIds,
      result,
    },
    placement.id,
  );

  // EndingSettlement is singleton per placement — do not recreate on idempotent settle
  const ending =
    next.endingSettlement &&
    next.endingSettlement.sourcePlacementId === placement.id
      ? next.endingSettlement
      : buildEndingSettlementFromVote({
          roomId: next.roomId,
          placement,
          execution: executions[placement.id],
          settlementResult: result,
          outcomeId,
          effectApplicationIds: appliedIds,
          snapshot: next.playableSnapshot,
          now: () => ts,
        });

  const note =
    result.status === "TIE"
      ? "已结算 · 平票"
      : result.status === "NO_DECISION"
        ? "已结算 · 无有效票"
        : `已结算 · 指认 ${winningOptionId || ""}`;

  return normalizePlayableRuntimeState({
    ...next,
    mechanismExecutions: executions,
    endingSettlement: ending,
    placementStatuses: upsertPlacementStatus(next, placement.id, {
      status: "SETTLED",
      note,
    }),
    updatedAt: ts,
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

  if (isM09(placement)) return settleM09(state, placement, exec, { now });
  if (isM03(placement)) return settleM03(state, placement, exec, { now });
  fail("MECHANISM_UNSUPPORTED", `Cannot settle ${placement.mechanismTemplateId}`);
}

export function getPlacementExecution(runtime, placementId) {
  const state = normalizePlayableRuntimeState(runtime);
  const raw = executionMap(state)[placementId];
  return raw ? normalizeMechanismExecution(raw, placementId) : null;
}

export function countVoteSubmissions(runtime, placementId) {
  const exec = getPlacementExecution(runtime, placementId);
  if (!exec?.gameState) return { submitted: 0, ballots: {} };
  const ballots = record(record(exec.gameState.ballots).main);
  return { submitted: Object.keys(ballots).length, ballots };
}

export function allParticipantsSubmitted(runtime, placementId) {
  const state = normalizePlayableRuntimeState(runtime);
  const roles = playerRoleIds(state.playableSnapshot);
  const { ballots } = countVoteSubmissions(state, placementId);
  return roles.every((rid) => Object.prototype.hasOwnProperty.call(ballots, rid));
}
