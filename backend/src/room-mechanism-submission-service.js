import { createHash } from "node:crypto";
import { throwErr } from "./api-errors.js";
import { canonicalReleaseJson } from "./world-release-contract.js";
import { projectMechanismRuntime } from "./mechanism-runtime.js";
import { loadRuntimeContentProvider } from "./runtime-content-provider.js";
import { transactionWithEvents } from "./transaction-events.js";
import { findRoomMechanismState } from "./repositories/room-mechanism-runtime-repository.js";
import {
  listRoomMechanismSubmissions,
  upsertRoomMechanismSubmission,
} from "./repositories/room-mechanism-submission-repository.js";
import { normalizeMechanismInteraction } from "../../shared/mechanism-interactions.js";

function packageChecksum(packageValue) {
  return createHash("sha256")
    .update(canonicalReleaseJson(packageValue), "utf8")
    .digest("hex");
}

function sameBinding(state, provider, packageValue) {
  return (
    state.contentBindingMode === provider.contentBinding.mode &&
    String(state.contentReleaseId ?? "") ===
      String(provider.contentBinding.release?.id ?? "") &&
    state.sourceContentRevision === Number(provider.sourceRevision) &&
    state.mechanismPackageSha256 === packageChecksum(packageValue)
  );
}

export function summarizeRoomMechanismSubmissions(rows = []) {
  const byDecision = new Map();
  for (const row of rows) {
    if (!byDecision.has(row.decisionKey)) {
      byDecision.set(row.decisionKey, {
        decisionKey: row.decisionKey,
        total: 0,
        options: new Map(),
        roles: [],
      });
    }
    const summary = byDecision.get(row.decisionKey);
    summary.total += 1;
    summary.options.set(
      row.optionKey,
      (summary.options.get(row.optionKey) || 0) + 1,
    );
    summary.roles.push({
      roleSlotId: row.roleSlotId,
      roleName: row.roleName,
      optionKey: row.optionKey,
      updatedAt: row.updatedAt,
    });
  }
  return [...byDecision.values()].map((summary) => ({
    decisionKey: summary.decisionKey,
    total: summary.total,
    options: [...summary.options].map(([optionKey, count]) => ({
      optionKey,
      count,
    })),
    roles: summary.roles,
  }));
}

export async function getRoomMechanismSubmissionSummary({
  roomId,
  state,
  client = null,
}) {
  if (!state?.initializedAt) return [];
  const rows = await listRoomMechanismSubmissions(roomId, state.initializedAt, {
    client,
  });
  return summarizeRoomMechanismSubmissions(rows);
}

export function inspectMechanismSubmissionWindow({
  interaction,
  roundStartedAt,
  now = new Date(),
}) {
  const normalized = normalizeMechanismInteraction(interaction);
  if (normalized.deadlineSeconds <= 0) {
    return { open: true, deadlineAt: null };
  }
  if (!roundStartedAt) {
    return { open: false, deadlineAt: null, reason: "clock_missing" };
  }
  const startedAt = new Date(roundStartedAt).getTime();
  if (!Number.isFinite(startedAt)) {
    return { open: false, deadlineAt: null, reason: "clock_invalid" };
  }
  const deadlineAt = new Date(startedAt + normalized.deadlineSeconds * 1000);
  return {
    open: new Date(now).getTime() < deadlineAt.getTime(),
    deadlineAt: deadlineAt.toISOString(),
    reason: new Date(now).getTime() < deadlineAt.getTime() ? "open" : "expired",
  };
}

export async function submitRoomMechanismDecisionPreference({
  roomId,
  actorId,
  roleSlotId,
  expectedRevision,
  decisionKey,
  optionKey,
  now = () => new Date(),
}) {
  return transactionWithEvents(async (client, queueEvent) => {
    const provider = await loadRuntimeContentProvider(roomId, {
      runQuery: client.query.bind(client),
      includeLiveSnapshot: true,
    });
    if (!provider) throwErr("ROOM_NOT_FOUND");
    const packageValue = provider.snapshot?.mechanismPackage ?? null;
    if (!packageValue) throwErr("MECHANISM_PACKAGE_NOT_FOUND");
    const state = await findRoomMechanismState(roomId, {
      client,
      forUpdate: true,
    });
    if (!state) throwErr("MECHANISM_RUNTIME_NOT_INITIALIZED");
    if (!sameBinding(state, provider, packageValue))
      throwErr("MECHANISM_RUNTIME_CONTENT_MISMATCH");
    if (
      !Number.isInteger(expectedRevision) ||
      expectedRevision !== state.revision
    ) {
      throwErr("MECHANISM_RUNTIME_REVISION_CONFLICT", undefined, {
        expectedRevision,
        currentRevision: state.revision,
      });
    }
    const available = projectMechanismRuntime(
      state.runtime,
      packageValue,
    ).availableDecisions;
    const decision = available.find((entry) => entry.key === decisionKey);
    if (!decision) throwErr("MECHANISM_DECISION_SUBMISSION_CLOSED");
    const interaction = normalizeMechanismInteraction(decision.interaction);
    if (
      !["advisory_choice", "private_choice"].includes(
        interaction.submissionMode,
      )
    ) {
      throwErr("MECHANISM_DECISION_SUBMISSION_CLOSED");
    }
    const submissionWindow = inspectMechanismSubmissionWindow({
      interaction,
      roundStartedAt: state.roundStartedAt,
      now: now(),
    });
    if (!submissionWindow.open) {
      throwErr("MECHANISM_DECISION_SUBMISSION_CLOSED");
    }
    if (!decision.options.some((option) => option.key === optionKey)) {
      throwErr("MECHANISM_ACTION_INVALID", "提交的机制选项不存在");
    }
    const submission = await upsertRoomMechanismSubmission(client, {
      roomId,
      runtimeInitializedAt: state.initializedAt,
      mechanismRevision: state.revision,
      roundKey: state.runtime.currentRoundKey,
      decisionKey,
      roleSlotId,
      actorId,
      optionKey,
    });
    const summary = await getRoomMechanismSubmissionSummary({
      roomId,
      state,
      client,
    });
    queueEvent(roomId, "room.mechanism_submission_updated", {
      decisionKey,
      submissionCount:
        summary.find((entry) => entry.decisionKey === decisionKey)?.total ?? 0,
    });
    return {
      decisionKey,
      optionKey: submission.optionKey,
      revision: state.revision,
      submittedAt: submission.updatedAt,
    };
  });
}
