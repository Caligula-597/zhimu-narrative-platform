import { createHash } from "node:crypto";
import { throwErr } from "./api-errors.js";
import { logHostAction } from "./audit-log.js";
import { canonicalReleaseJson } from "./world-release-contract.js";
import {
  MechanismRuntimeError,
  analyzeMechanismRuntimeReachability,
  advanceMechanismRound,
  executeMechanismDecision,
  executeMechanismInvestigation,
  executeMechanismOverride,
  initializeMechanismRuntime,
  projectMechanismRuntime,
} from "./mechanism-runtime.js";
import { loadRuntimeContentProvider } from "./runtime-content-provider.js";
import { transactionWithEvents } from "./transaction-events.js";
import {
  appendRoomMechanismAction,
  findRoomMechanismState,
  insertRoomMechanismState,
  listRoomMechanismActions,
  replaceRoomMechanismState,
  updateRoomMechanismRuntime,
} from "./repositories/room-mechanism-runtime-repository.js";
import {
  configureHostContentActionTransaction,
  hasActiveHostMembership,
} from "./repositories/host-content-action-repository.js";
import { getRoomMechanismSubmissionSummary } from "./room-mechanism-submission-service.js";
import { normalizeMechanismInteraction } from "../../shared/mechanism-interactions.js";

function packageChecksum(packageValue) {
  return createHash("sha256")
    .update(canonicalReleaseJson(packageValue), "utf8")
    .digest("hex");
}

function bindingFromProvider(provider, packageValue) {
  return {
    contentBindingMode: provider.contentBinding.mode,
    contentReleaseId: provider.contentBinding.release?.id ?? null,
    sourceContentRevision: Number(provider.sourceRevision),
    mechanismPackageSha256: packageChecksum(packageValue),
  };
}

function bindingMatches(state, binding) {
  return (
    state.contentBindingMode === binding.contentBindingMode &&
    String(state.contentReleaseId ?? "") ===
      String(binding.contentReleaseId ?? "") &&
    state.sourceContentRevision === binding.sourceContentRevision &&
    state.mechanismPackageSha256 === binding.mechanismPackageSha256
  );
}

async function assertHostAccess(client, roomId, actorId) {
  if (!(await hasActiveHostMembership(client, { roomId, actorId })))
    throwErr("HOST_ROLE_REQUIRED");
}

async function loadContext(roomId, client = null) {
  const runQuery = client?.query ? client.query.bind(client) : undefined;
  const provider = await loadRuntimeContentProvider(roomId, {
    ...(runQuery ? { runQuery } : {}),
    includeLiveSnapshot: true,
  });
  if (!provider) throwErr("ROOM_NOT_FOUND");
  const packageValue = provider.snapshot?.mechanismPackage ?? null;
  if (!packageValue) throwErr("MECHANISM_PACKAGE_NOT_FOUND");
  return {
    provider,
    packageValue,
    binding: bindingFromProvider(provider, packageValue),
  };
}

function translateRuntimeError(error) {
  if (!(error instanceof MechanismRuntimeError)) throw error;
  const details = { runtimeCode: error.code, ...(error.details ?? {}) };
  if (
    [
      "MECHANISM_STATE_INVALID",
      "MECHANISM_RESOURCE_INVALID",
      "MECHANISM_RESOURCE_OUT_OF_BOUNDS",
      "MECHANISM_OPERATION_UNSUPPORTED",
      "MECHANISM_EFFECT_INVALID",
    ].includes(error.code)
  )
    throwErr("MECHANISM_TRANSITION_INVALID", error.message, details);
  if (
    [
      "MECHANISM_OPTION_INVALID",
      "MECHANISM_STATE_UNKNOWN",
      "MECHANISM_RESOURCE_UNKNOWN",
      "MECHANISM_ROUND_UNKNOWN",
    ].includes(error.code)
  )
    throwErr("MECHANISM_ACTION_INVALID", error.message, details);
  throwErr("MECHANISM_ACTION_BLOCKED", error.message, details);
}

function runtimeResponse(state, packageValue, provider, extra = {}) {
  const stale = state
    ? !bindingMatches(state, bindingFromProvider(provider, packageValue))
    : false;
  return {
    initialized: Boolean(state),
    roomId: provider.room.id,
    worldId: provider.worldId,
    contentBinding: provider.contentBinding,
    stale,
    submissionSummary: extra.submissionSummary ?? [],
    state: state
      ? {
          revision: state.revision,
          initializedAt: state.initializedAt,
          roundStartedAt: state.roundStartedAt,
          updatedAt: state.updatedAt,
          ...projectMechanismRuntime(state.runtime, packageValue),
          reachability: stale
            ? null
            : analyzeMechanismRuntimeReachability(state.runtime, packageValue),
        }
      : null,
    ...extra,
  };
}

export function inspectMechanismDeadlineDefault({
  state,
  packageValue,
  action,
  now = new Date(),
}) {
  if (action?.type !== "decision") {
    return { required: false, allowed: true, reason: "not_deadline_action" };
  }
  const decision = projectMechanismRuntime(
    state?.runtime,
    packageValue,
  ).availableDecisions.find((entry) => entry.key === action?.decisionKey);
  if (!decision) {
    return { required: true, allowed: false, reason: "decision_unavailable" };
  }
  const interaction = normalizeMechanismInteraction(decision.interaction);
  if (interaction.kind !== "timed_crisis") {
    return action?.source === "deadline_default"
      ? { required: true, allowed: false, reason: "not_timed" }
      : { required: false, allowed: true, reason: "not_timed" };
  }
  if (interaction.deadlineSeconds <= 0 || !interaction.defaultOptionKey) {
    return { required: true, allowed: false, reason: "default_missing" };
  }
  if (
    action?.source === "deadline_default" &&
    interaction.defaultOptionKey !== action?.optionKey
  ) {
    return { required: true, allowed: false, reason: "default_mismatch" };
  }
  if (!state?.roundStartedAt) {
    return { required: true, allowed: false, reason: "clock_missing" };
  }
  const startedAt = new Date(state.roundStartedAt).getTime();
  if (!Number.isFinite(startedAt)) {
    return { required: true, allowed: false, reason: "clock_missing" };
  }
  const deadlineAt = new Date(
    startedAt + interaction.deadlineSeconds * 1000,
  ).toISOString();
  const expired = new Date(now).getTime() >= new Date(deadlineAt).getTime();
  if (action?.source === "deadline_default" && !expired) {
    return {
      required: true,
      allowed: false,
      reason: "too_early",
      deadlineAt,
    };
  }
  if (action?.source !== "deadline_default" && expired) {
    return {
      required: true,
      allowed: false,
      reason: "deadline_expired",
      deadlineAt,
      defaultOptionKey: interaction.defaultOptionKey,
    };
  }
  return {
    required: true,
    allowed: true,
    reason: expired ? "expired" : "before_deadline",
    deadlineAt,
    defaultOptionKey: interaction.defaultOptionKey,
  };
}

function publicMechanismEventData(action, state, packageValue) {
  const round =
    packageValue.rounds.find(
      (entry) => entry.key === state.runtime.currentRoundKey,
    ) ?? null;
  return {
    action,
    revision: state.revision,
    status: state.runtime.status,
    ...(state.runtime.currentRoundSequence == null
      ? {}
      : { roundSequence: state.runtime.currentRoundSequence }),
    ...(round?.title ? { roundTitle: round.title } : {}),
  };
}

export async function getRoomMechanismRuntime({
  roomId,
  includeHistory = false,
  historyLimit = 50,
}) {
  const { provider, packageValue } = await loadContext(roomId);
  const state = await findRoomMechanismState(roomId);
  const history = includeHistory
    ? await listRoomMechanismActions(roomId, {
        limit: Math.min(Math.max(Number(historyLimit) || 50, 1), 200),
      })
    : undefined;
  const submissionSummary = await getRoomMechanismSubmissionSummary({
    roomId,
    state,
  });
  return runtimeResponse(state, packageValue, provider, {
    submissionSummary,
    ...(history ? { history } : {}),
  });
}

export async function initializeRoomMechanismRuntime({
  roomId,
  actorId,
  resetExisting = false,
  expectedRevision = null,
}) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureHostContentActionTransaction(client);
    await assertHostAccess(client, roomId, actorId);
    const { provider, packageValue, binding } = await loadContext(
      roomId,
      client,
    );
    const existing = await findRoomMechanismState(roomId, {
      client,
      forUpdate: true,
    });
    if (existing && !resetExisting) {
      if (bindingMatches(existing, binding))
        return runtimeResponse(existing, packageValue, provider, {
          replayed: true,
        });
      throwErr("MECHANISM_RUNTIME_RESET_REQUIRED", undefined, {
        currentRevision: existing.revision,
        currentBinding: {
          mode: existing.contentBindingMode,
          releaseId: existing.contentReleaseId,
          sourceRevision: existing.sourceContentRevision,
        },
      });
    }
    if (
      existing &&
      (!Number.isInteger(expectedRevision) ||
        existing.revision !== expectedRevision)
    ) {
      throwErr("MECHANISM_RUNTIME_REVISION_CONFLICT", undefined, {
        expectedRevision,
        currentRevision: existing.revision,
      });
    }

    let initialized;
    try {
      initialized = initializeMechanismRuntime(packageValue);
    } catch (error) {
      translateRuntimeError(error);
    }
    const metadata = {
      initialChanges: initialized.changes,
      resetFromRevision: existing?.revision ?? null,
    };
    const state = existing
      ? await replaceRoomMechanismState(client, {
          roomId,
          expectedRevision: existing.revision,
          mechanismSchemaVersion: packageValue.schemaVersion,
          ...binding,
          actorId,
          runtime: initialized.runtime,
          metadata,
        })
      : await insertRoomMechanismState(client, {
          roomId,
          mechanismSchemaVersion: packageValue.schemaVersion,
          ...binding,
          actorId,
          runtime: initialized.runtime,
          metadata,
        });
    if (!state) throwErr("MECHANISM_RUNTIME_REVISION_CONFLICT");
    const actionType = existing ? "reset" : "initialize";
    await appendRoomMechanismAction(client, {
      roomId,
      actorId,
      revisionBefore: existing?.revision ?? 0,
      revisionAfter: state.revision,
      roundKey: state.runtime.currentRoundKey,
      actionType,
      changes: initialized.changes,
      request: { resetExisting },
      metadata: {
        contentBindingMode: binding.contentBindingMode,
        contentReleaseId: binding.contentReleaseId,
      },
    });
    await logHostAction(
      {
        roomId,
        actorUserId: actorId,
        action: `mechanism_${actionType}`,
        targetType: "mechanism_runtime",
        targetId: roomId,
        metadata: {
          revision: state.revision,
          roundKey: state.runtime.currentRoundKey,
          ...binding,
        },
      },
      client,
    );
    queueEvent(
      roomId,
      "room.mechanism_state_updated",
      publicMechanismEventData(actionType, state, packageValue),
    );
    return runtimeResponse(state, packageValue, provider, { replayed: false });
  });
}

function executeRuntimeAction(runtime, packageValue, actionInput) {
  try {
    if (actionInput.type === "decision")
      return executeMechanismDecision(runtime, packageValue, {
        decisionKey: actionInput.decisionKey,
        optionKey: actionInput.optionKey,
      });
    if (actionInput.type === "investigation")
      return executeMechanismInvestigation(runtime, packageValue, {
        investigationKey: actionInput.investigationKey,
        outcome: actionInput.outcome ?? "success",
      });
    if (actionInput.type === "advance")
      return advanceMechanismRound(runtime, packageValue);
    if (actionInput.type === "override")
      return executeMechanismOverride(runtime, packageValue, {
        effects: actionInput.effects,
        reason: actionInput.reason,
      });
    throwErr("MECHANISM_ACTION_INVALID", "Unsupported mechanism action type");
  } catch (error) {
    translateRuntimeError(error);
  }
}

export async function executeRoomMechanismAction({
  roomId,
  actorId,
  expectedRevision,
  action: actionInput,
  now = () => new Date(),
}) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureHostContentActionTransaction(client);
    await assertHostAccess(client, roomId, actorId);
    const { provider, packageValue, binding } = await loadContext(
      roomId,
      client,
    );
    const current = await findRoomMechanismState(roomId, {
      client,
      forUpdate: true,
    });
    if (!current) throwErr("MECHANISM_RUNTIME_NOT_INITIALIZED");
    if (!bindingMatches(current, binding))
      throwErr("MECHANISM_RUNTIME_CONTENT_MISMATCH", undefined, {
        currentRevision: current.revision,
      });
    if (
      !Number.isInteger(expectedRevision) ||
      current.revision !== expectedRevision
    ) {
      throwErr("MECHANISM_RUNTIME_REVISION_CONFLICT", undefined, {
        expectedRevision,
        currentRevision: current.revision,
      });
    }

    const deadlineDefault = inspectMechanismDeadlineDefault({
      state: current,
      packageValue,
      action: actionInput,
      now: now(),
    });
    if (deadlineDefault.required && !deadlineDefault.allowed) {
      throwErr(
        "MECHANISM_ACTION_BLOCKED",
        deadlineDefault.reason === "too_early"
          ? "限时机制尚未到期，不能提前执行默认后果"
          : deadlineDefault.reason === "deadline_expired"
            ? "限时机制已经到期，请按作者预设的默认方案结算"
            : "当前决策没有可执行的超时默认方案",
        deadlineDefault,
      );
    }

    const result = executeRuntimeAction(
      current.runtime,
      packageValue,
      actionInput ?? {},
    );
    const updated = await updateRoomMechanismRuntime(client, {
      roomId,
      expectedRevision: current.revision,
      runtime: result.runtime,
      restartRoundClock: result.action.type === "advance",
    });
    if (!updated) throwErr("MECHANISM_RUNTIME_REVISION_CONFLICT");
    const actionType = result.action.type;
    const actionKey =
      result.action.decisionKey ??
      result.action.investigationKey ??
      result.action.overrideKey ??
      result.action.fromRoundKey ??
      null;
    const optionKey = result.action.optionKey ?? result.action.outcome ?? null;
    await appendRoomMechanismAction(client, {
      roomId,
      actorId,
      revisionBefore: current.revision,
      revisionAfter: updated.revision,
      roundKey: current.runtime.currentRoundKey,
      actionType,
      actionKey,
      optionKey,
      changes: result.changes,
      request: actionInput,
      metadata: {
        toRoundKey: result.action.toRoundKey ?? null,
        endingRouteKey: result.runtime.ending?.resolvedRouteKey ?? null,
        source: actionInput?.source ?? "host_confirmed",
      },
    });
    await logHostAction(
      {
        roomId,
        actorUserId: actorId,
        action: `mechanism_${actionType}`,
        targetType: "mechanism_action",
        targetId: actionKey,
        metadata: {
          revisionBefore: current.revision,
          revisionAfter: updated.revision,
          roundKey: current.runtime.currentRoundKey,
          optionKey,
          reason: result.action.reason ?? null,
          changes: result.changes,
        },
      },
      client,
    );
    queueEvent(
      roomId,
      "room.mechanism_state_updated",
      publicMechanismEventData(actionType, updated, packageValue),
    );
    return runtimeResponse(updated, packageValue, provider, {
      appliedAction: result.action,
      changes: result.changes,
    });
  });
}
