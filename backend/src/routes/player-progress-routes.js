import { query } from "../db.js";
import { evaluateRoomRules } from "../rule-engine.js";
import { transactionWithEvents } from "../transaction-events.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { requireActor } from "../request-actor.js";
import { requireRoomRole } from "./route-guards.js";
import { sendErr, throwErr } from "../api-errors.js";
import {
  completeSectionSchema,
  deleteNotebookEntrySchema,
  notebookEntrySchema,
  roomIdParams,
  submitMiniGameSchema
} from "./schemas.js";
import { submitMiniGameAnswer } from "../room-mini-games.js";

export async function registerPlayerProgressRoutes(app) {
  app.post("/api/rooms/game/submit", { schema: submitMiniGameSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, answer } = request.body ?? {};
    const gameId = request.body?.instanceId || request.body?.instance_id || request.body?.gameId || request.body?.game_id;
    if (!gameId) return sendErr(reply, "BAD_REQUEST", "game id is required");
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");

    let result;
    await transactionWithEvents(async (client, queueEvent) => {
      result = await submitMiniGameAnswer(client, { roomId, gameId, actorUserId: actorId, answer });
      if (!result.found) return;
      const eventType = result.completed ? "room.game_completed" : "room.game_updated";
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'public', $3, $4, jsonb_build_object('gameId', $5::text, 'correct', $6::boolean))`,
        [
          roomId,
          actorId,
          result.completed ? "mini_game_completed" : "mini_game_submitted",
          result.correct ? "玩家解开小游戏机关" : "玩家尝试小游戏机关",
          gameId,
          result.correct
        ]
      );
      queueEvent(roomId, eventType, { currentGame: result.game, correct: result.correct });
    });
    if (!result?.found) return sendErr(reply, "NOT_FOUND", "Mini game not found");
    return {
      ok: true,
      correct: result.correct,
      currentGame: result.game,
      attemptsLeft: result.game?.attemptsLeft ?? null,
      attempts_left: result.game?.attemptsLeft ?? null
    };
  });

  app.post("/api/rooms/:roomId/sections/:sectionId/complete", { schema: completeSectionSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, sectionId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
    const section = await query(
      `SELECT ss.id
       FROM script_sections ss
       JOIN rooms room ON room.id = $1
       WHERE ss.id = $2
         AND ss.role_slot_id = $3
         AND (
           ss.publication_status = 'published'
           OR (room.status = 'testing' AND ss.publication_status = 'testing')
         )
         AND (
           ss.sequence = 1 OR EXISTS (
             SELECT 1 FROM room_content_unlocks rcu
             WHERE rcu.room_id = $1 AND rcu.content_type = 'script_section' AND rcu.content_id = ss.id
           )
         )`,
      [roomId, sectionId, membership.role_slot_id]
    );
    if (!section.rowCount) throwErr("SECTION_LOCKED");

    return withRoomIdempotency(roomId, request, "sections.complete", async () => {
      await transactionWithEvents(async (client, queueEvent) => {
        await client.query(
          `INSERT INTO reading_progress (room_id, role_slot_id, script_section_id, started_at, completed_at)
           VALUES ($1, $2, $3, now(), now())
           ON CONFLICT (room_id, role_slot_id, script_section_id)
           DO UPDATE SET completed_at = COALESCE(reading_progress.completed_at, now())`,
          [roomId, membership.role_slot_id, sectionId]
        );
        await client.query(
          `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
           VALUES ($1, $2, 'host', 'reading_completed', '玩家完成一段角色阅读', jsonb_build_object('sectionId', $3::text))`,
          [roomId, actorId, sectionId]
        );
        queueEvent(roomId, "room.section_completed", {
          sectionId,
          roleSlotId: membership.role_slot_id
        });
      });
      const executedRules = await evaluateRoomRules(roomId);
      return { ok: true, executedRules };
    });
  });

  app.post("/api/rooms/:roomId/notebook", { schema: notebookEntrySchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
    const { sourceType, sourceId, title, body } = request.body ?? {};
    if (!sourceType || !title || !body) return sendErr(reply, "NOTEBOOK_FIELDS_REQUIRED");
    const result = await query(
      `INSERT INTO notebook_entries (room_id, role_slot_id, created_by_user_id, source_type, source_id, title, body)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [roomId, membership.role_slot_id, actorId, sourceType, sourceId ?? null, title, body]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.delete("/api/rooms/:roomId/notebook/:entryId", { schema: deleteNotebookEntrySchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, entryId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
    const result = await query(
      `DELETE FROM notebook_entries
       WHERE id = $1 AND room_id = $2 AND role_slot_id = $3
       RETURNING id`,
      [entryId, roomId, membership.role_slot_id]
    );
    if (!result.rowCount) return sendErr(reply, "NOTEBOOK_ENTRY_NOT_FOUND");
    return { ok: true };
  });

  app.get("/api/rooms/:roomId/my-timeline", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
    const rows = await query(
      `SELECT id, event_type, message, metadata, visibility, created_at,
              (actor_user_id = $2) AS is_self
       FROM timeline_logs
       WHERE room_id = $1
         AND (visibility IN ('public', 'player') OR actor_user_id = $2)
       ORDER BY created_at DESC
       LIMIT 60`,
      [roomId, actorId]
    );
    return {
      roomId,
      roleSlotId: membership.role_slot_id,
      items: rows.rows
    };
  });
}
