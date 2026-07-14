import { query } from "../db.js";
import { previewRoomRules, triggerManualRule } from "../rule-engine.js";
import { transactionWithEvents } from "../transaction-events.js";
import { requireActor } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import {
  forceCompleteMiniGameSchema,
  roomIdParams,
  roomRulesPreviewSchema,
  startMiniGameSchema,
  triggerManualRuleSchema,
  updateRoomSettingsSchema
} from "./schemas.js";
import { logHostAction } from "../audit-log.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { forceCompleteMiniGame, listRoomMiniGames, startLockMiniGame } from "../room-mini-games.js";
import { requireHostMembership } from "./host-route-guards.js";

export async function registerHostGameControlRoutes(app) {
  app.get("/api/rooms/:roomId/host/mini-games", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const games = await listRoomMiniGames(roomId, { limit: 50 });
    return { games };
  });

  app.post("/api/rooms/:roomId/host/mini-games", { schema: startMiniGameSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);

    return withRoomIdempotency(roomId, request, "host.mini_game_start", async () => {
      let currentGame;
      await transactionWithEvents(async (client, queueEvent) => {
        currentGame = await startLockMiniGame(client, {
          roomId,
          actorUserId: actorId,
          body: request.body ?? {}
        });
        await client.query(
          `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
           VALUES ($1, $2, 'public', 'mini_game_started', $3, jsonb_build_object('gameId', $4::text, 'gameType', $5::text))`,
          [roomId, actorId, `主持人启动小游戏：${currentGame.title}`, currentGame.id, currentGame.gameType]
        );
        queueEvent(roomId, "room.game_started", { currentGame });
      });
      await logHostAction({
        roomId,
        actorUserId: actorId,
        action: "mini_game_started",
        targetType: "mini_game",
        targetId: currentGame.id,
        metadata: { gameType: currentGame.gameType, title: currentGame.title }
      });
      return { ok: true, currentGame };
    });
  });

  app.post("/api/rooms/:roomId/host/mini-games/:gameId/force-complete", { schema: forceCompleteMiniGameSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, gameId } = request.params;
    await requireHostMembership(actorId, roomId);

    let currentGame;
    await transactionWithEvents(async (client, queueEvent) => {
      currentGame = await forceCompleteMiniGame(client, { roomId, gameId, actorUserId: actorId });
      if (!currentGame) return;
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'public', 'mini_game_completed', $3, jsonb_build_object('gameId', $4::text, 'forced', true))`,
        [roomId, actorId, `主持人结束小游戏：${currentGame.title}`, currentGame.id]
      );
      queueEvent(roomId, "room.game_completed", { currentGame, forced: true });
    });
    if (!currentGame) return sendErr(reply, "NOT_FOUND", "Mini game not found");
    await logHostAction({
      roomId,
      actorUserId: actorId,
      action: "mini_game_force_completed",
      targetType: "mini_game",
      targetId: currentGame.id
    });
    return { ok: true, currentGame };
  });

  app.get("/api/rooms/:roomId/rules/preview", { schema: roomRulesPreviewSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const rules = await previewRoomRules(roomId);
    return { rules };
  });

  app.post("/api/rooms/:roomId/rules/:ruleId/trigger", { schema: triggerManualRuleSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, ruleId } = request.params;
    await requireHostMembership(actorId, roomId);

    return withRoomIdempotency(roomId, request, "host.rule_trigger", async () => {
      const result = await triggerManualRule(roomId, ruleId);
      await logHostAction({
        roomId,
        actorUserId: actorId,
        action: "manual_rule_triggered",
        targetType: "rule",
        targetId: ruleId,
        metadata: { ruleName: result.ruleName }
      });
      return result;
    });
  });

  app.patch("/api/rooms/:roomId/settings", { schema: updateRoomSettingsSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const incoming = request.body?.settings ?? {};
    await requireHostMembership(actorId, roomId);
    const result = await query(
      `UPDATE rooms
       SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb, updated_at = now()
       WHERE id = $1
       RETURNING id, name, settings`,
      [roomId, JSON.stringify(incoming)]
    );
    if (!result.rowCount) return sendErr(reply, "ROOM_NOT_FOUND");
    await logHostAction({
      roomId,
      actorUserId: actorId,
      action: "room_settings_updated",
      targetType: "room",
      targetId: roomId,
      metadata: { settings: incoming }
    });
    return { ok: true, settings: result.rows[0].settings };
  });
}
