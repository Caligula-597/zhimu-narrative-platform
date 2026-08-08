import { createHash } from "node:crypto";
import { throwErr } from "./api-errors.js";
import { canonicalReleaseJson } from "./world-release-contract.js";
import {
  projectMechanismRuntime,
  resolvePlayerMechanismAnswer,
} from "./mechanism-runtime.js";
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

function storedAnswer(row, inputMode) {
  const answer =
    row?.answer && typeof row.answer === "object" && !Array.isArray(row.answer)
      ? row.answer
      : {};
  if (inputMode === "ranking") {
    return { type: "ranking", optionKeys: Array.isArray(answer.optionKeys) ? answer.optionKeys : [] };
  }
  if (inputMode === "allocation") {
    return { type: "allocation", allocations: Array.isArray(answer.allocations) ? answer.allocations : [] };
  }
  return {
    type: "single_choice",
    optionKey: String(answer.optionKey ?? row?.optionKey ?? ""),
  };
}

function emptyOptionAggregate(optionKey) {
  return {
    optionKey,
    count: 0,
    firstPlaceCount: 0,
    score: 0,
    allocated: 0,
  };
}

function majorityFor(summary) {
  const metric =
    summary.inputMode === "ranking"
      ? "score"
      : summary.inputMode === "allocation"
        ? "allocated"
        : "count";
  const ordered = [...summary.options].sort(
    (left, right) => right[metric] - left[metric],
  );
  const leadingValue = Number(ordered[0]?.[metric] ?? 0);
  const tied = ordered.filter((entry) => Number(entry[metric]) === leadingValue);
  if (!leadingValue) {
    return { status: "empty", optionKey: "", metric, value: 0, strictMajority: false };
  }
  if (tied.length !== 1) {
    return { status: "tie", optionKey: "", metric, value: leadingValue, strictMajority: false };
  }
  return {
    status: "ready",
    optionKey: tied[0].optionKey,
    metric,
    value: leadingValue,
    strictMajority:
      metric === "count" && leadingValue > Number(summary.total || 0) / 2,
  };
}

export function summarizeRoomMechanismSubmissions(rows = [], decisions = []) {
  const decisionByKey = new Map(
    decisions.map((decision) => [String(decision?.key ?? ""), decision]),
  );
  const byDecision = new Map();
  for (const row of rows) {
    if (!byDecision.has(row.decisionKey)) {
      const decision = decisionByKey.get(String(row.decisionKey)) ?? null;
      const interaction = normalizeMechanismInteraction(decision?.interaction);
      byDecision.set(row.decisionKey, {
        decisionKey: row.decisionKey,
        inputMode: interaction.inputMode,
        total: 0,
        options: new Map(
          (decision?.options ?? []).map((option) => [
            String(option?.key ?? ""),
            emptyOptionAggregate(String(option?.key ?? "")),
          ]),
        ),
        roles: [],
      });
    }
    const summary = byDecision.get(row.decisionKey);
    summary.total += 1;
    const answer = storedAnswer(row, summary.inputMode);
    const ensureOption = (optionKey) => {
      const key = String(optionKey ?? "");
      if (!key) return null;
      if (!summary.options.has(key)) {
        summary.options.set(key, emptyOptionAggregate(key));
      }
      return summary.options.get(key);
    };
    if (summary.inputMode === "ranking") {
      answer.optionKeys.forEach((optionKey, index) => {
        const aggregate = ensureOption(optionKey);
        if (!aggregate) return;
        aggregate.score += answer.optionKeys.length - index;
        if (index === 0) {
          aggregate.count += 1;
          aggregate.firstPlaceCount += 1;
        }
      });
    } else if (summary.inputMode === "allocation") {
      for (const allocation of answer.allocations) {
        const aggregate = ensureOption(allocation?.optionKey);
        const amount = Number(allocation?.amount);
        if (!aggregate || !Number.isSafeInteger(amount) || amount < 0) continue;
        aggregate.allocated += amount;
        if (amount > 0) aggregate.count += 1;
      }
    } else {
      const aggregate = ensureOption(answer.optionKey);
      if (aggregate) aggregate.count += 1;
    }
    summary.roles.push({
      roleSlotId: row.roleSlotId,
      roleName: row.roleName,
      optionKey: row.optionKey,
      answer,
      updatedAt: row.updatedAt,
    });
  }
  return [...byDecision.values()].map((summary) => {
    const projected = {
      decisionKey: summary.decisionKey,
      inputMode: summary.inputMode,
      total: summary.total,
      options: [...summary.options.values()],
      roles: summary.roles,
    };
    return { ...projected, majority: majorityFor(projected) };
  });
}

export async function getRoomMechanismSubmissionSummary({
  roomId,
  state,
  packageValue = null,
  client = null,
}) {
  if (!state?.initializedAt) return [];
  const rows = await listRoomMechanismSubmissions(roomId, state.initializedAt, {
    client,
  });
  const decisions = packageValue
    ? projectMechanismRuntime(state.runtime, packageValue).availableDecisions
    : [];
  return summarizeRoomMechanismSubmissions(rows, decisions);
}

export function resolveMechanismMajorityOption(summary) {
  return summary?.majority?.status === "ready"
    ? String(summary.majority.optionKey ?? "")
    : "";
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
  answer,
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
    const selection = resolvePlayerMechanismAnswer(
      available,
      decisionKey,
      answer ?? { type: "single_choice", optionKey },
    );
    if (!selection) throwErr("MECHANISM_DECISION_SUBMISSION_INVALID");
    const { decision } = selection;
    const interaction = normalizeMechanismInteraction(decision.interaction);
    if (
      ![
        "advisory_choice",
        "private_choice",
        "secret_ballot",
        "private_ranking",
        "private_allocation",
      ].includes(
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
    const submission = await upsertRoomMechanismSubmission(client, {
      roomId,
      runtimeInitializedAt: state.initializedAt,
      mechanismRevision: state.revision,
      roundKey: state.runtime.currentRoundKey,
      decisionKey: selection.decisionKey,
      roleSlotId,
      actorId,
      optionKey: selection.optionKey,
      answer: selection.answer,
    });
    const summary = await getRoomMechanismSubmissionSummary({
      roomId,
      state,
      packageValue,
      client,
    });
    queueEvent(roomId, "room.mechanism_submission_updated", {
      decisionKey: selection.decisionKey,
      submissionCount:
        summary.find(
          (entry) => entry.decisionKey === selection.decisionKey,
        )?.total ?? 0,
    });
    return {
      decisionKey,
      ...(selection.publicAnswer.type === "single_choice"
        ? { optionKey: selection.publicAnswer.optionKey }
        : {}),
      answer: selection.publicAnswer,
      revision: state.revision,
      submittedAt: submission.updatedAt,
    };
  });
}
