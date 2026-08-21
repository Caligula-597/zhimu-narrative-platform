import { throwErr } from "./api-errors.js";
import {
  ROOM_EXPERIENCE_STATE_KINDS,
  normalizeRoomExperienceIdentity,
  normalizeRoomExperiencePayload,
} from "./room-experience-state.js";
import {
  findRoomExperienceState,
  insertRoomExperienceState,
  updateRoomExperienceState,
} from "./repositories/room-experience-state-repository.js";
import { transactionWithEvents } from "./transaction-events.js";

const STATE_KIND = ROOM_EXPERIENCE_STATE_KINDS.PACE_CLOCK;
const SCOPE_KEY = "room_clock";
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const ACTIONS = new Set(["configure", "start", "pause", "reset", "extend", "set_visibility"]);

function clockIdentity() {
  return normalizeRoomExperienceIdentity({
    stateKind: STATE_KIND,
    scopeKey: SCOPE_KEY,
    subjectKey: "room",
    visibility: "room",
  });
}

function defaultPayload(now = new Date().toISOString()) {
  return normalizeRoomExperiencePayload(STATE_KIND, {
    mode: "countup",
    status: "idle",
    label: "本幕节奏",
    durationMs: 0,
    elapsedMs: 0,
    startedAt: null,
    visibleToPlayers: false,
    updatedAt: now,
  });
}

function effectiveElapsed(payload, nowMs) {
  const stored = Math.max(0, Number(payload.elapsedMs) || 0);
  if (payload.status !== "running" || !payload.startedAt) return stored;
  const startedMs = new Date(payload.startedAt).getTime();
  return stored + (Number.isFinite(startedMs) ? Math.max(0, nowMs - startedMs) : 0);
}

export function projectPaceClockState(state, { audience = "host", now = new Date() } = {}) {
  if (!state) {
    if (audience === "player") return null;
    const payload = defaultPayload(now.toISOString());
    return { ...payload, revision: 0, serverNow: now.toISOString() };
  }
  const payload = state.payload || {};
  if (audience === "player" && !payload.visibleToPlayers) return null;
  const elapsedMs = effectiveElapsed(payload, now.getTime());
  const complete = payload.mode === "countdown"
    && elapsedMs >= Number(payload.durationMs || 0)
    && payload.status === "running";
  return {
    mode: payload.mode,
    status: complete ? "completed" : payload.status,
    label: payload.label || "本幕节奏",
    durationMs: Number(payload.durationMs) || 0,
    elapsedMs: payload.mode === "countdown"
      ? Math.min(elapsedMs, Number(payload.durationMs) || 0)
      : elapsedMs,
    startedAt: payload.startedAt || null,
    visibleToPlayers: Boolean(payload.visibleToPlayers),
    revision: state.revision,
    updatedAt: state.updatedAt,
    serverNow: now.toISOString(),
  };
}

function normalizeAction(input = {}) {
  const action = String(input.action || "");
  const expectedRevision = Number(input.expectedRevision);
  if (!ACTIONS.has(action)) throwErr("PACE_CLOCK_ACTION_INVALID");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throwErr("PACE_CLOCK_REVISION_REQUIRED");
  }
  return { ...input, action, expectedRevision };
}

export function buildPaceClockPayload({ previous, input, now = new Date() }) {
  const current = previous || defaultPayload(now.toISOString());
  const elapsedMs = effectiveElapsed(current, now.getTime());
  let next = { ...current, elapsedMs, startedAt: null, updatedAt: now.toISOString() };

  if (input.action === "configure") {
    const mode = input.mode === "countdown" ? "countdown" : input.mode === "countup" ? "countup" : null;
    const durationMs = Number(input.durationMs) || 0;
    if (!mode || (mode === "countdown" && (durationMs < 1000 || durationMs > MAX_DURATION_MS))) {
      throwErr("PACE_CLOCK_ACTION_INVALID");
    }
    next = {
      ...next,
      mode,
      durationMs: mode === "countdown" ? durationMs : 0,
      elapsedMs: 0,
      status: "idle",
      label: String(input.label || current.label || "本幕节奏").trim().slice(0, 80),
    };
  } else if (input.action === "start") {
    if (current.status === "completed") throwErr("PACE_CLOCK_ACTION_INVALID");
    next.status = "running";
    next.startedAt = now.toISOString();
  } else if (input.action === "pause") {
    if (current.status !== "running") throwErr("PACE_CLOCK_ACTION_INVALID");
    next.status = current.mode === "countdown" && elapsedMs >= current.durationMs ? "completed" : "paused";
  } else if (input.action === "reset") {
    next.status = "idle";
    next.elapsedMs = 0;
  } else if (input.action === "extend") {
    const extendMs = Number(input.extendMs);
    if (current.mode !== "countdown" || !Number.isSafeInteger(extendMs) || extendMs < 1000) {
      throwErr("PACE_CLOCK_ACTION_INVALID");
    }
    next.durationMs = current.durationMs + extendMs;
    if (next.durationMs > MAX_DURATION_MS) throwErr("PACE_CLOCK_ACTION_INVALID");
    if (current.status === "completed") next.status = "paused";
    else if (current.status === "running") next.startedAt = now.toISOString();
  } else if (input.action === "set_visibility") {
    if (typeof input.visibleToPlayers !== "boolean") throwErr("PACE_CLOCK_ACTION_INVALID");
    next.visibleToPlayers = input.visibleToPlayers;
    next.status = current.status;
    next.startedAt = current.status === "running" ? now.toISOString() : null;
  }

  return normalizeRoomExperiencePayload(STATE_KIND, next, { now });
}

export async function getRoomPaceClock(roomId, { audience = "host" } = {}) {
  const state = await findRoomExperienceState(roomId, {
    stateKind: STATE_KIND,
    scopeKey: SCOPE_KEY,
    subjectKey: "room",
  });
  return { clock: projectPaceClockState(state, { audience }) };
}

export async function applyHostPaceClockAction({ roomId, actorId, input }) {
  const actionInput = normalizeAction(input);
  return transactionWithEvents(async (client, queueEvent) => {
    const identity = clockIdentity();
    const existing = await findRoomExperienceState(roomId, {
      stateKind: STATE_KIND,
      scopeKey: SCOPE_KEY,
      subjectKey: "room",
      client,
      forUpdate: true,
    });
    if ((existing?.revision || 0) !== actionInput.expectedRevision) {
      throwErr("PACE_CLOCK_VERSION_CONFLICT", undefined, {
        expectedRevision: actionInput.expectedRevision,
        currentRevision: existing?.revision || 0,
      });
    }
    const now = new Date();
    const payload = buildPaceClockPayload({ previous: existing?.payload, input: actionInput, now });
    const saved = existing
      ? await updateRoomExperienceState(client, {
          roomId,
          ...identity,
          expectedRevision: actionInput.expectedRevision,
          payload,
          actorId,
        })
      : await insertRoomExperienceState(client, {
          roomId,
          ...identity,
          payload,
          actorId,
        });
    if (!saved) throwErr("PACE_CLOCK_VERSION_CONFLICT");
    queueEvent(roomId, "room.pace_clock_updated", {
      revision: saved.revision,
      status: payload.status,
      visibleToPlayers: payload.visibleToPlayers,
    });
    return { clock: projectPaceClockState(saved, { audience: "host", now }) };
  });
}
