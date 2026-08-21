import { throwErr } from "./api-errors.js";
import { createRoomRecap } from "./recap-service.js";
import { transactionWithEvents } from "./transaction-events.js";
import { buildRuntimeCurrentState } from "./runtime-current-state-service.js";
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
import {
  configureHostGameControlTransaction,
  insertHostGameControlAudit,
  lockHostGameControlRoom,
  mergeHostRoomSettings,
} from "./repositories/host-game-control-repository.js";

const STATE_KIND = ROOM_EXPERIENCE_STATE_KINDS.SESSION_CONCLUSION;
const SCOPE_KEY = "room_conclusion";

function identity() {
  return normalizeRoomExperienceIdentity({
    stateKind: STATE_KIND,
    scopeKey: SCOPE_KEY,
    subjectKey: "room",
    visibility: "room",
  });
}

export function projectRoomConclusion(state, { audience = "host" } = {}) {
  if (!state) return { status: "idle", endingId: null, recapId: null, revision: 0 };
  const payload = state.payload || {};
  return {
    status: payload.status,
    endingId: payload.endingId || null,
    recapId: payload.recapId || null,
    revision: state.revision,
    updatedAt: state.updatedAt,
    ...(audience === "host" && payload.failureCode ? { failureCode: payload.failureCode } : {}),
  };
}

async function readState(roomId, { client = null, forUpdate = false } = {}) {
  return findRoomExperienceState(roomId, {
    stateKind: STATE_KIND,
    scopeKey: SCOPE_KEY,
    subjectKey: "room",
    client,
    forUpdate,
  });
}

export async function getRoomConclusion(roomId, { audience = "host" } = {}) {
  return { conclusion: projectRoomConclusion(await readState(roomId), { audience }) };
}

function conclusionEvent(state) {
  const projected = projectRoomConclusion(state, { audience: "player" });
  return {
    status: projected.status,
    endingId: projected.endingId || "",
    recapId: projected.recapId || "",
    revision: projected.revision,
  };
}

async function prepareConclusion({ roomId, actorId, endingId, idempotencyKey }) {
  const currentState = await buildRuntimeCurrentState({ roomId, audience: "host" });
  const map = currentState?.presentation?.map;
  const ending = map?.host?.endingCandidates?.find(
    (candidate) => String(candidate.id) === String(endingId)
  ) || (String(map?.publishedEnding?.id) === String(endingId) ? map.publishedEnding : null);
  if (!ending) throwErr("CONCLUSION_ENDING_INVALID");

  return transactionWithEvents(async (client, queueEvent) => {
    await configureHostGameControlTransaction(client);
    const room = await lockHostGameControlRoom(client, { roomId, actorId });
    if (!room) throwErr("HOST_ROLE_REQUIRED");
    const existing = await readState(roomId, { client, forUpdate: true });
    if (existing && existing.payload?.idempotencyKey !== idempotencyKey) {
      throwErr("CONCLUSION_ALREADY_PREPARED");
    }
    if (existing && ["publishing", "recap_pending", "ready"].includes(existing.payload?.status)) {
      return { state: existing, ending, shouldGenerate: false };
    }

    const now = new Date().toISOString();
    const updatedRoom = await mergeHostRoomSettings(client, {
      roomId,
      settings: {
        runtimePresentation: {
          publishedEnding: { id: endingId, publishedAt: now },
          updatedAt: now,
        },
      },
    });
    if (!updatedRoom) throwErr("ROOM_NOT_FOUND");
    const payload = normalizeRoomExperiencePayload(STATE_KIND, {
      status: "recap_pending",
      endingId,
      recapId: null,
      idempotencyKey,
      failureCode: null,
      updatedAt: now,
    });
    const state = existing
      ? await updateRoomExperienceState(client, {
          roomId,
          ...identity(),
          expectedRevision: existing.revision,
          payload,
          actorId,
        })
      : await insertRoomExperienceState(client, {
          roomId,
          ...identity(),
          payload,
          actorId,
        });
    if (!state) throwErr("CONCLUSION_VERSION_CONFLICT");
    await insertHostGameControlAudit(client, {
      roomId,
      actorId,
      action: "ending_published_recap_prepared",
      targetType: "ending",
      targetId: endingId,
      metadata: { idempotencyKey },
    });
    const presentation = updatedRoom.settings?.runtimePresentation || {};
    queueEvent(roomId, "room.presentation_updated", {
      activeSegmentKey: presentation.activeSegmentKey || "",
      activeLocationId: presentation.activeLocationId || "",
      revealedLocationIds: presentation.revealedLocationIds || [],
      mapVisible: Boolean(presentation.mapVisible),
      checkStatus: presentation.activeCheck?.status || "cleared",
      checkLabel: presentation.activeCheck?.label || "",
      encounterStatus: presentation.activeEncounter?.status || "cleared",
      encounterLocationId: presentation.activeEncounter?.locationId || "",
      updatedAt: presentation.updatedAt || now,
    });
    queueEvent(roomId, "room.conclusion_updated", conclusionEvent(state));
    return { state, ending, shouldGenerate: true };
  });
}

async function settleConclusion({ roomId, actorId, idempotencyKey, status, recapId = null, failureCode = null }) {
  return transactionWithEvents(async (client, queueEvent) => {
    const existing = await readState(roomId, { client, forUpdate: true });
    if (!existing || existing.payload?.idempotencyKey !== idempotencyKey) {
      throwErr("CONCLUSION_VERSION_CONFLICT");
    }
    const payload = normalizeRoomExperiencePayload(STATE_KIND, {
      ...existing.payload,
      status,
      recapId,
      failureCode,
      updatedAt: new Date().toISOString(),
    });
    const saved = await updateRoomExperienceState(client, {
      roomId,
      ...identity(),
      expectedRevision: existing.revision,
      payload,
      actorId,
    });
    if (!saved) throwErr("CONCLUSION_VERSION_CONFLICT");
    queueEvent(roomId, "room.conclusion_updated", conclusionEvent(saved));
    return saved;
  });
}

export async function publishEndingAndPrepareRecap({
  roomId,
  actorId,
  endingId,
  idempotencyKey,
  title,
  description = "",
  logger,
}) {
  const key = String(idempotencyKey || "").trim();
  if (!key) throwErr("CONCLUSION_IDEMPOTENCY_REQUIRED");
  const prepared = await prepareConclusion({ roomId, actorId, endingId, idempotencyKey: key });
  if (!prepared.shouldGenerate) {
    return { conclusion: projectRoomConclusion(prepared.state, { audience: "host" }) };
  }
  try {
    const recap = await createRoomRecap({
      actorId,
      roomId,
      title: String(title || `${prepared.ending.name} · 复盘`),
      description,
      conclusionKey: key,
      endingId,
      logger,
    });
    const ready = await settleConclusion({
      roomId,
      actorId,
      idempotencyKey: key,
      status: "ready",
      recapId: recap.id,
    });
    return { conclusion: projectRoomConclusion(ready, { audience: "host" }), recap };
  } catch (error) {
    await settleConclusion({
      roomId,
      actorId,
      idempotencyKey: key,
      status: "failed",
      failureCode: error?.code || "RECAP_GENERATION_FAILED",
    }).catch(() => {});
    throw error;
  }
}
