import { httpError, throwErr } from "./api-errors.js";
import {
  configureHostCommunicationTransaction,
  hasActiveHostCommunicationMembership,
  insertHostCommunicationAudit,
  insertHostManualTimelineLog,
  insertHostNudgeTimelineLog,
  listActivePlayerRoleSlotIdsForCommunication,
  listPendingHostCommunicationEvents,
  roleBelongsToCommunicationRoomWorld
} from "./repositories/host-communication-repository.js";
import { eventRelatedRoleIds, extractTriggerPlayers } from "./routes/host-helpers.js";
import { requireHostMembership } from "./routes/host-route-guards.js";
import { transactionWithEvents } from "./transaction-events.js";

const DEFAULT_NUDGE_MESSAGE = "主持人正在处理待确认事件，请稍等；确认后新内容会自动解锁。";

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map(String))];
}

export function resolveHostNudgeTargets({ requestedRoleIds, pendingRows, activeRoleIds }) {
  const active = new Set(uniqueStrings(activeRoleIds));
  const requested = uniqueStrings(requestedRoleIds);
  if (requested.length) return requested.filter((roleSlotId) => active.has(roleSlotId));

  const related = new Set();
  for (const row of pendingRows || []) {
    eventRelatedRoleIds({
      trigger_players: extractTriggerPlayers(row.rule_conditions),
      actions: row.actions
    }).forEach((roleSlotId) => related.add(String(roleSlotId)));
  }
  const activeRelated = [...related].filter((roleSlotId) => active.has(roleSlotId));
  return activeRelated.length ? activeRelated : [...active];
}

export function normalizeHostCommunicationError(error) {
  if (["40P01", "55P03"].includes(error?.code)) {
    return httpError(409, "Host communication is busy; retry shortly", "HOST_COMMUNICATION_BUSY");
  }
  if (error?.code === "57014") {
    return httpError(503, "Host communication exceeded its safe execution window", "HOST_COMMUNICATION_TIMEOUT");
  }
  return error;
}

async function assertTransactionHostMembership(client, { actorId, roomId }) {
  if (!await hasActiveHostCommunicationMembership(client, { actorId, roomId })) {
    throwErr("HOST_ROLE_REQUIRED");
  }
}

export async function createHostManualLog({ actorId, roomId, message, eventType, roleSlotId }) {
  await requireHostMembership(actorId, roomId);
  const normalizedMessage = String(message ?? "").trim();
  if (!normalizedMessage) throwErr("BAD_REQUEST", "message is required");
  const normalizedEventType = String(eventType || "host_note").trim() || "host_note";

  try {
    return await transactionWithEvents(async (client, queueEvent) => {
      await configureHostCommunicationTransaction(client);
      await assertTransactionHostMembership(client, { actorId, roomId });
      if (roleSlotId && !await roleBelongsToCommunicationRoomWorld(client, { roomId, roleSlotId })) {
        throwErr("ROLE_SLOT_WORLD_MISMATCH");
      }
      const row = await insertHostManualTimelineLog(client, {
        roomId,
        actorId,
        eventType: normalizedEventType,
        message: normalizedMessage,
        roleSlotId
      });
      await insertHostCommunicationAudit(client, {
        roomId,
        actorId,
        action: "host_manual_log",
        targetId: row.id,
        metadata: { eventType: normalizedEventType, roleSlotId: roleSlotId ?? null }
      });
      queueEvent(roomId, "room.host_log_created", {
        logId: String(row.id),
        eventType: normalizedEventType,
        ...(roleSlotId ? { roleSlotId: String(roleSlotId) } : {})
      });
      return { ok: true, logId: String(row.id) };
    });
  } catch (error) {
    throw normalizeHostCommunicationError(error);
  }
}

export async function nudgeWaitingPlayers({ actorId, roomId, message, roleSlotIds }) {
  await requireHostMembership(actorId, roomId);
  const text = String(message ?? "").trim() || DEFAULT_NUDGE_MESSAGE;
  const requestedRoleIds = uniqueStrings(roleSlotIds);

  try {
    return await transactionWithEvents(async (client, queueEvent) => {
      await configureHostCommunicationTransaction(client);
      await assertTransactionHostMembership(client, { actorId, roomId });
      const activeRoleIds = await listActivePlayerRoleSlotIdsForCommunication(client, roomId);
      const pendingRows = requestedRoleIds.length
        ? []
        : await listPendingHostCommunicationEvents(client, roomId);
      const targets = resolveHostNudgeTargets({ requestedRoleIds, pendingRows, activeRoleIds });
      if (!targets.length) throwErr("NO_PLAYERS_TO_NUDGE", "当前没有可提醒的已入房玩家。");

      const row = await insertHostNudgeTimelineLog(client, {
        roomId,
        actorId,
        message: text,
        roleSlotIds: targets
      });
      await insertHostCommunicationAudit(client, {
        roomId,
        actorId,
        action: "host_nudge_waiting",
        targetId: row.id,
        metadata: { roleSlotIds: targets, message: text }
      });
      queueEvent(roomId, "room.host_nudge", { message: text, roleSlotIds: targets });
      return { ok: true, notifiedCount: targets.length, roleSlotIds: targets };
    });
  } catch (error) {
    throw normalizeHostCommunicationError(error);
  }
}
