import { query, transaction } from "../db.js";
import { executeActionsWithClient, evaluateRoomRules, previewRoomRules, triggerManualRule, queueRuleActionEvents } from "../rule-engine.js";
import { transactionWithEvents } from "../transaction-events.js";
import { publishRoomEvent } from "../room-event-bus.js";
import { requireActor } from "../request-actor.js";
import { requireRoomRole } from "./route-guards.js";
import { sendErr, throwErr } from "../api-errors.js";
import {
  hostEventSchema,
  hostEventDelaySchema,
  hostEventBatchSchema,
  hostGrantClueSchema,
  hostGrantItemSchema,
  hostLogSchema,
  hostNotesSchema,
  hostClueNoteSchema,
  hostUnlockSectionSchema,
  paramsSchema,
  roomIdParams,
  roleSlotRoomParams,
  roomRulesPreviewSchema,
  triggerManualRuleSchema,
  updateRoomSettingsSchema
} from "./schemas.js";
import {
  eventSourceLabel,
  extractTriggerPlayers,
  fetchHostPlayerDetail,
  fetchHostPlayers,
  summarizeHostAction
} from "./host-helpers.js";
import { fetchHostClueMatrix } from "./clue-helpers.js";
import { grantItemToInventory } from "../inventory-helpers.js";
import { logHostAction, listHostAuditLog } from "../audit-log.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { dismissHostEventById, executeHostEventById, batchHostEvents, delayHostEventById } from "./host-event-actions.js";
import { wakeDueDelayedHostEvents } from "../host-delay-wake.js";

async function requireHostMembership(actorId, roomId) {
  const membership = await requireRoomRole(actorId, roomId);
  if (!["host", "cohost"].includes(membership.member_type)) {
    throwErr("HOST_ROLE_REQUIRED");
  }
  return membership;
}

async function assertRoleInRoomWorld(runQuery, roomId, roleSlotId) {
  const result = await runQuery(
    `SELECT 1 FROM role_slots rs
     JOIN rooms r ON r.world_id = rs.world_id
     WHERE r.id = $1 AND rs.id = $2`,
    [roomId, roleSlotId]
  );
  if (!result.rowCount) {
    throwErr("ROLE_SLOT_WORLD_MISMATCH");
  }
}

export async function registerHostRoutes(app) {
  app.get("/api/rooms/:roomId/host/players", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const players = await fetchHostPlayers(query, roomId);
    const stuckCount = players.filter((player) => player.maybe_stuck).length;
    return { players, stuckCount };
  });

  app.get("/api/rooms/:roomId/host/clue-matrix", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return fetchHostClueMatrix(query, roomId);
  });

  app.put("/api/rooms/:roomId/host/clues/:clueId/notes", { schema: hostClueNoteSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, clueId } = request.params;
    const { roleSlotId, hostNote = "" } = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    await assertRoleInRoomWorld(query, roomId, roleSlotId);
    const result = await query(
      `UPDATE clue_ownership SET host_note = $4
       WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3
       RETURNING host_note`,
      [roomId, roleSlotId, clueId, hostNote]
    );
    if (!result.rowCount) return sendErr(reply, "CLUE_OWNERSHIP_NOT_FOUND");
    return { ok: true, hostNote: result.rows[0].host_note };
  });

  app.get("/api/rooms/:roomId/host/players/:roleSlotId", { schema: { params: roleSlotRoomParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, roleSlotId } = request.params;
    await requireHostMembership(actorId, roomId);
    const detail = await fetchHostPlayerDetail(query, roomId, roleSlotId);
    if (!detail) return sendErr(reply, "ROLE_SLOT_NOT_FOUND");
    return detail;
  });

  app.get("/api/rooms/:roomId/host/audit-log", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const limit = Math.min(Math.max(Number(request.query?.limit) || 50, 1), 200);
    const entries = await listHostAuditLog(roomId, { limit });
    return { entries };
  });

  app.get("/api/rooms/:roomId/rules/preview", { schema: roomRulesPreviewSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const rules = await previewRoomRules(roomId);
    return { rules };
  });

  app.post("/api/rooms/:roomId/rules/:ruleId/trigger", { schema: triggerManualRuleSchema }, async (request, reply) => {
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

  app.post("/api/rooms/:roomId/host/grant-clue", { schema: hostGrantClueSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { roleSlotId, roleSlotIds, clueId, message } = request.body ?? {};
    const targets = [
      ...new Set(
        [...(roleSlotIds ?? []), roleSlotId].filter(Boolean)
      )
    ];
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

  app.post("/api/rooms/:roomId/host/grant-item", { schema: hostGrantItemSchema }, async (request, reply) => {
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
          [
            roomId,
            actorId,
            message || `主持人发放物品「${item.name}」`,
            roleSlotId,
            itemId
          ]
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
        await executeActionsWithClient(client, roomId, [{
          type: "unlock_script_section",
          scriptSectionId
        }]);
        await client.query(
          `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
           VALUES ($1, $2, 'host', 'host_unlock_section', $3, jsonb_build_object('roleSlotId', $4::text, 'sectionId', $5::text))`,
          [
            roomId,
            actorId,
            message || `主持人手动解锁分幕「${section.rows[0].title}」`,
            roleSlotId,
            scriptSectionId
          ]
        );
        queueEvent(roomId, "room.section_unlocked", {
          scriptSectionId,
          roleSlotId,
          source: "host_manual"
        });
      });
      return { ok: true };
    });
  });

  app.post("/api/rooms/:roomId/host/log", { schema: hostLogSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { message, eventType, roleSlotId } = request.body ?? {};
    if (!message?.trim()) return sendErr(reply, "BAD_REQUEST", "message is required");
    await requireHostMembership(actorId, roomId);
    if (roleSlotId) {
      await transaction(async (client) => assertRoleInRoomWorld(client, roomId, roleSlotId));
    }
    await query(
      `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
       VALUES ($1, $2, 'host', $3, $4, jsonb_build_object('roleSlotId', $5::text, 'source', 'host_manual'))`,
      [roomId, actorId, eventType || "host_note", message.trim(), roleSlotId ?? null]
    );
    return { ok: true };
  });

  app.put("/api/rooms/:roomId/host/players/:roleSlotId/notes", { schema: hostNotesSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, roleSlotId } = request.params;
    const { notes } = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    await transaction(async (client) => {
      await assertRoleInRoomWorld((text, params) => client.query(text, params), roomId, roleSlotId);
      await client.query(
        `INSERT INTO player_states (room_id, role_slot_id, variables, updated_at)
         VALUES ($1, $2, jsonb_build_object('hostNotes', $3::text), now())
         ON CONFLICT (room_id, role_slot_id)
         DO UPDATE SET variables = COALESCE(player_states.variables, '{}'::jsonb) || jsonb_build_object('hostNotes', $3::text),
                       updated_at = now()`,
        [roomId, roleSlotId, notes ?? ""]
      );
    });
    return { ok: true };
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
      queueEvent(roomId, "room.scene_unlocked", {
        sceneId,
        sceneName: scene.rows[0].name,
        source: "host_manual"
      });
    });
    return { ok: true };
  });

  app.get("/api/rooms/:roomId/host-events", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    await wakeDueDelayedHostEvents();
    const result = await query(
      `SELECT phe.id, phe.event_key, phe.title, phe.description, phe.status, phe.created_at,
              phe.delay_until,
              phe.rule_id, phe.actions,
              ar.name AS rule_name, ar.conditions AS rule_conditions, ar.mode AS rule_mode
       FROM pending_host_events phe
       LEFT JOIN automation_rules ar ON ar.id = phe.rule_id
       WHERE phe.room_id = $1 AND phe.status IN ('pending', 'delayed')
       ORDER BY CASE WHEN phe.status = 'delayed' THEN 1 ELSE 0 END, phe.created_at`,
      [roomId]
    );
    return result.rows.map((event) => ({
      ...event,
      source_label: eventSourceLabel(event),
      action_summaries: (event.actions ?? []).map(summarizeHostAction),
      trigger_players: extractTriggerPlayers(event.rule_conditions)
    }));
  });

  app.post("/api/rooms/:roomId/host-events/batch", { schema: hostEventBatchSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const { action, eventIds } = request.body;

    return withRoomIdempotency(roomId, request, "host.event_batch", async () => {
      const result = await batchHostEvents(roomId, actorId, action, eventIds);
      if (!result.ok) return sendErr(reply, result.code, result.message);
      return result;
    });
  });

  app.post("/api/rooms/:roomId/host-events/:eventId/dismiss", { schema: hostEventSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, eventId } = request.params;
    await requireHostMembership(actorId, roomId);

    return withRoomIdempotency(roomId, request, "host.event_dismiss", async () => {
      const result = await dismissHostEventById(roomId, actorId, eventId);
      if (!result.ok) return sendErr(reply, result.code);
      return { ok: true };
    });
  });

  app.post("/api/rooms/:roomId/host-events/:eventId/execute", { schema: hostEventSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, eventId } = request.params;
    await requireHostMembership(actorId, roomId);

    return withRoomIdempotency(roomId, request, "host.event_execute", async () => {
      const result = await executeHostEventById(roomId, actorId, eventId);
      if (!result.ok) return sendErr(reply, result.code);
      return { ok: true };
    });
  });

  app.post("/api/rooms/:roomId/host-events/:eventId/delay", { schema: hostEventDelaySchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, eventId } = request.params;
    const { delayMinutes } = request.body ?? {};
    await requireHostMembership(actorId, roomId);

    return withRoomIdempotency(roomId, request, "host.event_delay", async () => {
      const result = await delayHostEventById(roomId, actorId, eventId, delayMinutes);
      if (!result.ok) return sendErr(reply, result.code);
      await logHostAction({
        roomId,
        actorUserId: actorId,
        action: "host_event_delayed",
        targetType: "host_event",
        targetId: eventId,
        metadata: { delayMinutes: result.delayMinutes }
      });
      return { ok: true, delayMinutes: result.delayMinutes };
    });
  });

  app.get("/api/rooms/:roomId/host-progress", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const players = await fetchHostPlayers(query, roomId);
    return players.map((player) => ({
      role_slot_id: player.role_slot_id,
      name: player.role_name,
      total_sections: player.total_sections,
      completed_sections: player.completed_sections,
      current_scene_id: player.current_scene_id,
      updated_at: player.last_activity_at
    }));
  });
}

