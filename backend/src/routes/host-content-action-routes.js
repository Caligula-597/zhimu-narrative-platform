import { query } from "../db.js";
import { executeActionsWithClient, evaluateRoomRules } from "../rule-engine.js";
import { transactionWithEvents } from "../transaction-events.js";
import { requireActor } from "../request-actor.js";
import { sendErr, throwErr } from "../api-errors.js";
import {
  hostGrantClueSchema,
  hostGrantItemSchema,
  hostUnlockSectionSchema,
  paramsSchema
} from "./schemas.js";
import { grantItemToInventory } from "../inventory-helpers.js";
import { logHostAction } from "../audit-log.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { assertRoleInRoomWorld, requireHostMembership } from "./host-route-guards.js";

export async function registerHostContentActionRoutes(app) {
  app.post("/api/rooms/:roomId/host/grant-clue", { schema: hostGrantClueSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { roleSlotId, roleSlotIds, clueId, message } = request.body ?? {};
    const targets = [...new Set([...(roleSlotIds ?? []), roleSlotId].filter(Boolean))];
    if (!targets.length) return sendErr(reply, "ROLE_SLOT_IMPORT_REQUIRED", "请指定至少一名目标角色。");
    await requireHostMembership(actorId, roomId);
    const clue = await query(
      `SELECT c.id, c.name FROM clues c
       JOIN rooms r ON r.world_id = c.world_id
       WHERE c.id = $1 AND r.id = $2`,
      [clueId, roomId]
    );
    if (!clue.rowCount) return sendErr(reply, "CLUE_WORLD_MISMATCH");

    return withRoomIdempotency(roomId, request, "host.grant_clue", async () => {
      await transactionWithEvents(async (client, queueEvent) => {
        for (const slotId of targets) {
          await assertRoleInRoomWorld((text, params) => client.query(text, params), roomId, slotId);
          await executeActionsWithClient(client, roomId, [{
            type: "grant_clue",
            roleSlotId: slotId,
            clueId,
            source: "host_manual"
          }]);
          queueEvent(roomId, "room.clue_granted", {
            clueId,
            roleSlotId: slotId,
            clueName: clue.rows[0].name,
            source: "host_manual"
          });
        }
        await client.query(
          `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
           VALUES ($1, $2, 'host', 'host_grant_clue', $3, jsonb_build_object('roleSlotIds', $4::jsonb, 'clueId', $5::text))`,
          [
            roomId,
            actorId,
            message || `主持人手动发放线索「${clue.rows[0].name}」给 ${targets.length} 名玩家`,
            JSON.stringify(targets),
            clueId
          ]
        );
      });
      await logHostAction({
        roomId,
        actorUserId: actorId,
        action: "host_grant_clue",
        targetType: "clue",
        targetId: clueId,
        metadata: { roleSlotIds: targets }
      });
      return { ok: true, granted: targets.length };
    });
  });

  app.post("/api/rooms/:roomId/host/grant-item", { schema: hostGrantItemSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { roleSlotId, itemId, quantity = 1, message } = request.body ?? {};
    await requireHostMembership(actorId, roomId);

    return withRoomIdempotency(roomId, request, "host.grant_item", async () => {
      let item;
      await transactionWithEvents(async (client, queueEvent) => {
        item = await grantItemToInventory(client, {
          roomId,
          roleSlotId,
          itemId,
          quantity,
          source: "host_manual"
        });
        await client.query(
          `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
           VALUES ($1, $2, 'host', 'host_grant_item', $3, jsonb_build_object('roleSlotId', $4::text, 'itemId', $5::text))`,
          [roomId, actorId, message || `主持人发放物品「${item.name}」`, roleSlotId, itemId]
        );
        queueEvent(roomId, "room.item_granted", {
          itemId,
          roleSlotId,
          itemName: item.name,
          source: "host_manual"
        });
      });
      await logHostAction({
        roomId,
        actorUserId: actorId,
        action: "host_grant_item",
        targetType: "item",
        targetId: itemId,
        metadata: { roleSlotId, quantity }
      });
      const executedRules = await evaluateRoomRules(roomId);
      return { ok: true, item: { id: item.id, name: item.name }, executedRules };
    });
  });

  app.post("/api/rooms/:roomId/host/unlock-section", { schema: hostUnlockSectionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { roleSlotId, scriptSectionId, message } = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    const section = await query(
      `SELECT ss.id, ss.title FROM script_sections ss
       JOIN role_slots rs ON rs.id = ss.role_slot_id
       JOIN rooms r ON r.world_id = rs.world_id
       WHERE ss.id = $1 AND ss.role_slot_id = $2 AND r.id = $3`,
      [scriptSectionId, roleSlotId, roomId]
    );
    if (!section.rowCount) return sendErr(reply, "SECTION_NOT_FOUND");

    return withRoomIdempotency(roomId, request, "host.unlock_section", async () => {
      await transactionWithEvents(async (client, queueEvent) => {
        await executeActionsWithClient(client, roomId, [{ type: "unlock_script_section", scriptSectionId }]);
        await client.query(
          `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
           VALUES ($1, $2, 'host', 'host_unlock_section', $3, jsonb_build_object('roleSlotId', $4::text, 'sectionId', $5::text))`,
          [roomId, actorId, message || `主持人手动解锁分幕「${section.rows[0].title}」`, roleSlotId, scriptSectionId]
        );
        queueEvent(roomId, "room.section_unlocked", { scriptSectionId, roleSlotId, source: "host_manual" });
      });
      return { ok: true };
    });
  });

  app.post("/api/rooms/:roomId/scenes/:sceneId/unlock", {
    schema: { params: paramsSchema({ roomId: { type: "string", minLength: 36, maxLength: 36 }, sceneId: { type: "string", minLength: 36, maxLength: 36 } }) }
  }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, sceneId } = request.params;
    await requireHostMembership(actorId, roomId);
    const scene = await query(
      `SELECT s.name FROM scenes s JOIN rooms r ON r.world_id = s.world_id
       WHERE s.id = $1 AND r.id = $2`,
      [sceneId, roomId]
    );
    if (!scene.rowCount) throwErr("SCENE_WORLD_MISMATCH");
    await transactionWithEvents(async (client, queueEvent) => {
      await executeActionsWithClient(client, roomId, [{ type: "unlock_scene", sceneId }]);
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'scene_unlocked', $3, jsonb_build_object('sceneId', $4::text))`,
        [roomId, actorId, `主持人开放场景「${scene.rows[0].name}」`, sceneId]
      );
      queueEvent(roomId, "room.scene_unlocked", { sceneId, sceneName: scene.rows[0].name, source: "host_manual" });
    });
    return { ok: true };
  });
}
