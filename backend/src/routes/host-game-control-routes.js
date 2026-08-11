import {
  forceCompleteHostMiniGame,
  listHostMiniGames,
  previewHostRoomRules,
  startHostMiniGame,
  startHostRoomSession,
  triggerHostManualRule,
  updateHostRoomSettings
} from "../host-game-control-service.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { requireActor } from "../request-actor.js";
import {
  forceCompleteMiniGameSchema,
  roomIdParams,
  roomRulesPreviewSchema,
  startMiniGameSchema,
  triggerManualRuleSchema,
  updateRoomSettingsSchema
} from "./schemas.js";

export async function registerHostGameControlRoutes(app) {
  app.post(
    "/api/rooms/:roomId/host/start",
    { schema: { params: roomIdParams } },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      return withRoomIdempotency(roomId, request, "host.room_start", () => (
        startHostRoomSession({ actorId, roomId })
      ));
    }
  );

  app.get(
    "/api/rooms/:roomId/host/mini-games",
    { schema: { params: roomIdParams } },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      const games = await listHostMiniGames({ actorId, roomId, limit: 50 });
      return { games };
    }
  );

  app.post(
    "/api/rooms/:roomId/host/mini-games",
    { schema: startMiniGameSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      return withRoomIdempotency(roomId, request, "host.mini_game_start", () => (
        startHostMiniGame({ actorId, roomId, body: request.body })
      ));
    }
  );

  app.post(
    "/api/rooms/:roomId/host/mini-games/:gameId/force-complete",
    { schema: forceCompleteMiniGameSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId, gameId } = request.params;
      return forceCompleteHostMiniGame({ actorId, roomId, gameId });
    }
  );

  app.get(
    "/api/rooms/:roomId/rules/preview",
    { schema: roomRulesPreviewSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      const rules = await previewHostRoomRules({ actorId, roomId });
      return { rules };
    }
  );

  app.post(
    "/api/rooms/:roomId/rules/:ruleId/trigger",
    { schema: triggerManualRuleSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId, ruleId } = request.params;
      return withRoomIdempotency(roomId, request, "host.rule_trigger", () => (
        triggerHostManualRule({ actorId, roomId, ruleId })
      ));
    }
  );

  app.patch(
    "/api/rooms/:roomId/settings",
    { schema: updateRoomSettingsSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      return updateHostRoomSettings({
        actorId,
        roomId,
        settings: request.body?.settings
      });
    }
  );
}
