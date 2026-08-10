import { httpError, throwErr } from "./api-errors.js";
import {
  forceCompleteMiniGame,
  listRoomMiniGames,
  startLockMiniGame
} from "./room-mini-games.js";
import {
  previewRoomRules,
  triggerManualRuleWithClient
} from "./rule-engine.js";
import {
  configureHostGameControlTransaction,
  insertHostGameControlAudit,
  insertMiniGameTimelineLog,
  lockHostGameControlRoom,
  mergeHostRoomSettings
} from "./repositories/host-game-control-repository.js";
import { requireHostMembership } from "./routes/host-route-guards.js";
import { transactionWithEvents } from "./transaction-events.js";

export function normalizeHostGameControlError(error) {
  const activeGameConflict = error?.code === "23505"
    && error?.constraint === "idx_room_mini_games_one_active";
  if (["40001", "40P01", "55P03"].includes(error?.code) || activeGameConflict) {
    return httpError(409, "Host game control is busy; retry shortly", "HOST_GAME_CONTROL_BUSY");
  }
  if (error?.code === "57014") {
    return httpError(
      503,
      "Host game control exceeded its safe execution window",
      "HOST_GAME_CONTROL_TIMEOUT"
    );
  }
  return error;
}

async function assertLockedHostRoom(client, { actorId, roomId }) {
  if (!await lockHostGameControlRoom(client, { actorId, roomId })) {
    throwErr("HOST_ROLE_REQUIRED");
  }
}

export async function listHostMiniGames({ actorId, roomId, limit = 50 }) {
  await requireHostMembership(actorId, roomId);
  return listRoomMiniGames(roomId, { limit });
}

export async function previewHostRoomRules({ actorId, roomId }) {
  await requireHostMembership(actorId, roomId);
  return previewRoomRules(roomId);
}

export async function startHostMiniGame({ actorId, roomId, body }) {
  await requireHostMembership(actorId, roomId);
  try {
    return await transactionWithEvents(async (client, queueEvent) => {
      await configureHostGameControlTransaction(client);
      await assertLockedHostRoom(client, { actorId, roomId });
      const currentGame = await startLockMiniGame(client, {
        roomId,
        actorUserId: actorId,
        body: body ?? {}
      });
      await insertMiniGameTimelineLog(client, { roomId, actorId, currentGame });
      await insertHostGameControlAudit(client, {
        roomId,
        actorId,
        action: "mini_game_started",
        targetType: "mini_game",
        targetId: currentGame.id,
        metadata: { gameType: currentGame.gameType, title: currentGame.title }
      });
      queueEvent(roomId, "room.game_started", { currentGame });
      return { ok: true, currentGame };
    });
  } catch (error) {
    throw normalizeHostGameControlError(error);
  }
}

export async function forceCompleteHostMiniGame({ actorId, roomId, gameId }) {
  await requireHostMembership(actorId, roomId);
  try {
    return await transactionWithEvents(async (client, queueEvent) => {
      await configureHostGameControlTransaction(client);
      await assertLockedHostRoom(client, { actorId, roomId });
      const currentGame = await forceCompleteMiniGame(client, {
        roomId,
        gameId,
        actorUserId: actorId
      });
      if (!currentGame) throwErr("NOT_FOUND", "Mini game not found");
      await insertMiniGameTimelineLog(client, {
        roomId,
        actorId,
        currentGame,
        completed: true
      });
      await insertHostGameControlAudit(client, {
        roomId,
        actorId,
        action: "mini_game_force_completed",
        targetType: "mini_game",
        targetId: currentGame.id
      });
      queueEvent(roomId, "room.game_completed", { currentGame, forced: true });
      return { ok: true, currentGame };
    });
  } catch (error) {
    throw normalizeHostGameControlError(error);
  }
}

export async function triggerHostManualRule({ actorId, roomId, ruleId }) {
  await requireHostMembership(actorId, roomId);
  try {
    return await transactionWithEvents(async (client, queueEvent) => {
      await configureHostGameControlTransaction(client);
      await assertLockedHostRoom(client, { actorId, roomId });
      const result = await triggerManualRuleWithClient(client, queueEvent, roomId, ruleId);
      await insertHostGameControlAudit(client, {
        roomId,
        actorId,
        action: "manual_rule_triggered",
        targetType: "rule",
        targetId: ruleId,
        metadata: { ruleName: result.ruleName }
      });
      return result;
    });
  } catch (error) {
    throw normalizeHostGameControlError(error);
  }
}

export async function updateHostRoomSettings({ actorId, roomId, settings }) {
  await requireHostMembership(actorId, roomId);
  const incoming = settings ?? {};
  try {
    return await transactionWithEvents(async (client, queueEvent) => {
      await configureHostGameControlTransaction(client);
      await assertLockedHostRoom(client, { actorId, roomId });
      const room = await mergeHostRoomSettings(client, { roomId, settings: incoming });
      if (!room) throwErr("ROOM_NOT_FOUND");
      await insertHostGameControlAudit(client, {
        roomId,
        actorId,
        action: "room_settings_updated",
        targetType: "room",
        targetId: roomId,
        metadata: { settings: incoming }
      });
      if (incoming.runtimePresentation) {
        const presentation = room.settings?.runtimePresentation || incoming.runtimePresentation;
        queueEvent(roomId, "room.presentation_updated", {
          activeSegmentKey: presentation.activeSegmentKey || "",
          activeLocationId: presentation.activeLocationId || "",
          revealedLocationIds: presentation.revealedLocationIds || [],
          mapVisible: Boolean(presentation.mapVisible),
          checkStatus: presentation.activeCheck?.status || "cleared",
          checkLabel: presentation.activeCheck?.label || "",
          encounterStatus: presentation.activeEncounter?.status || "cleared",
          encounterLocationId: presentation.activeEncounter?.locationId || "",
          updatedAt: presentation.updatedAt
        });
      }
      return { ok: true, settings: room.settings };
    });
  } catch (error) {
    throw normalizeHostGameControlError(error);
  }
}
