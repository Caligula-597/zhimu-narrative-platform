import { query, transaction } from "../db.js";
import { executeActions, executeActionsWithClient, evaluateRoomRules } from "../rule-engine.js";
import { publishRoomEvent } from "../room-event-bus.js";
import { requireActor } from "../request-actor.js";
import { requireRoomRole } from "./route-guards.js";
import {
  hostEventSchema,
  hostGrantClueSchema,
  hostGrantItemSchema,
  hostLogSchema,
  hostNotesSchema,
  hostClueNoteSchema,
  hostUnlockSectionSchema,
  paramsSchema,
  roomIdParams,
  roleSlotRoomParams
} from "./schemas.js";
import {
  eventSourceLabel,
  fetchHostPlayerDetail,
  fetchHostPlayers,
  summarizeHostAction
} from "./host-helpers.js";
import { fetchHostClueMatrix } from "./clue-helpers.js";
import { grantItemToInventory } from "../inventory-helpers.js";

async function requireHostMembership(actorId, roomId) {
  const membership = await requireRoomRole(actorId, roomId);
  if (!["host", "cohost"].includes(membership.member_type)) {
    throw Object.assign(new Error("Host role required"), { statusCode: 403 });
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
  if (!result.rowCount) throw Object.assign(new Error("Role slot not found in room world"), { statusCode: 404 });
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
    if (!result.rowCount) return reply.code(404).send({ error: "Clue ownership not found" });
    return { ok: true, hostNote: result.rows[0].host_note };
  });

  app.get("/api/rooms/:roomId/host/players/:roleSlotId", { schema: { params: roleSlotRoomParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, roleSlotId } = request.params;
    await requireHostMembership(actorId, roomId);
    const detail = await fetchHostPlayerDetail(query, roomId, roleSlotId);
    if (!detail) return reply.code(404).send({ error: "Role slot not found" });
    return detail;
  });

  app.post("/api/rooms/:roomId/host/grant-clue", { schema: hostGrantClueSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { roleSlotId, clueId, message } = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    const clue = await query(
      `SELECT c.id, c.name FROM clues c
       JOIN rooms r ON r.world_id = c.world_id
       WHERE c.id = $1 AND r.id = $2`,
      [clueId, roomId]
    );
    if (!clue.rowCount) return reply.code(404).send({ error: "Clue not found in room world" });
    await transaction(async (client) => {
      await assertRoleInRoomWorld((text, params) => client.query(text, params), roomId, roleSlotId);
      await executeActionsWithClient(client, roomId, [{
        type: "grant_clue",
        roleSlotId,
        clueId,
        source: "host_manual"
      }]);
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'host_grant_clue', $3, jsonb_build_object('roleSlotId', $4::text, 'clueId', $5::text))`,
        [
          roomId,
          actorId,
          message || `主持人手动发放线索「${clue.rows[0].name}」`,
          roleSlotId,
          clueId
        ]
      );
    });
    publishRoomEvent(roomId, "room.clue_granted", {
      clueId,
      roleSlotId,
      clueName: clue.rows[0].name,
      source: "host_manual"
    });
    return { ok: true };
  });

  app.post("/api/rooms/:roomId/host/grant-item", { schema: hostGrantItemSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { roleSlotId, itemId, quantity = 1, message } = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    let item;
    await transaction(async (client) => {
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
    });
    publishRoomEvent(roomId, "room.item_granted", {
      itemId,
      roleSlotId,
      itemName: item.name,
      source: "host_manual"
    });
    const executedRules = await evaluateRoomRules(roomId);
    return { ok: true, item: { id: item.id, name: item.name }, executedRules };
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
    if (!section.rowCount) return reply.code(404).send({ error: "Script section not found for role" });
    await transaction(async (client) => {
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
    });
    return { ok: true };
  });

  app.post("/api/rooms/:roomId/host/log", { schema: hostLogSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { message, eventType, roleSlotId } = request.body ?? {};
    if (!message?.trim()) return reply.code(400).send({ error: "message is required" });
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
    if (!scene.rowCount) throw Object.assign(new Error("Scene not found in room world"), { statusCode: 404 });
    await transaction(async (client) => {
      await executeActionsWithClient(client, roomId, [{ type: "unlock_scene", sceneId }]);
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'scene_unlocked', $3, jsonb_build_object('sceneId', $4::text))`,
        [roomId, actorId, `主持人开放场景「${scene.rows[0].name}」`, sceneId]
      );
    });
    publishRoomEvent(roomId, "room.scene_unlocked", {
      sceneId,
      sceneName: scene.rows[0].name,
      source: "host_manual"
    });
    return { ok: true };
  });

  app.get("/api/rooms/:roomId/host-events", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const result = await query(
      `SELECT phe.id, phe.event_key, phe.title, phe.description, phe.status, phe.created_at,
              phe.rule_id, phe.actions,
              ar.name AS rule_name, ar.conditions AS rule_conditions, ar.mode AS rule_mode
       FROM pending_host_events phe
       LEFT JOIN automation_rules ar ON ar.id = phe.rule_id
       WHERE phe.room_id = $1 AND phe.status IN ('pending', 'delayed')
       ORDER BY phe.created_at`,
      [roomId]
    );
    return result.rows.map((event) => ({
      ...event,
      source_label: eventSourceLabel(event),
      action_summaries: (event.actions ?? []).map(summarizeHostAction),
      trigger_players: extractTriggerPlayers(event.rule_conditions)
    }));
  });

  app.post("/api/rooms/:roomId/host-events/:eventId/dismiss", { schema: hostEventSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, eventId } = request.params;
    await requireHostMembership(actorId, roomId);
    const event = await query(
      `SELECT id, title FROM pending_host_events
       WHERE id = $1 AND room_id = $2 AND status IN ('pending', 'delayed')`,
      [eventId, roomId]
    );
    if (!event.rowCount) return reply.code(404).send({ error: "Pending host event not found" });
    await query(
      `UPDATE pending_host_events
       SET status = 'dismissed', resolved_at = now(), resolved_by_user_id = $1
       WHERE id = $2`,
      [actorId, eventId]
    );
    await query(
      `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
       VALUES ($1, $2, 'host', 'host_event_dismissed', $3, jsonb_build_object('eventId', $4::text))`,
      [roomId, actorId, `主持人拒绝待确认事件「${event.rows[0].title}」`, eventId]
    );
    publishRoomEvent(roomId, "room.host_event_pending", { action: "dismissed", eventId });
    return { ok: true };
  });

  app.post("/api/rooms/:roomId/host-events/:eventId/execute", { schema: hostEventSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, eventId } = request.params;
    await requireHostMembership(actorId, roomId);
    const event = await query(
      `SELECT * FROM pending_host_events WHERE id = $1 AND room_id = $2 AND status IN ('pending', 'delayed')`,
      [eventId, roomId]
    );
    if (!event.rowCount) return reply.code(404).send({ error: "Pending host event not found" });
    await executeActions(roomId, event.rows[0].actions);
    await transaction(async (client) => {
      await client.query(
        `UPDATE pending_host_events
         SET status = 'executed', resolved_at = now(), resolved_by_user_id = $1
         WHERE id = $2`,
        [actorId, eventId]
      );
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'host_event_executed', $3, jsonb_build_object('eventId', $4::text))`,
        [roomId, actorId, `主持人确认并执行「${event.rows[0].title}」`, eventId]
      );
      if (event.rows[0].rule_id) {
        await client.query(
          `INSERT INTO rule_executions (rule_id, room_id, result)
           VALUES ($1, $2, '{"status":"host_confirmed"}'::jsonb)
           ON CONFLICT (rule_id, room_id) DO NOTHING`,
          [event.rows[0].rule_id, roomId]
        );
      }
    });
    for (const action of event.rows[0].actions ?? []) {
      if (action.type === "unlock_scene") {
        publishRoomEvent(roomId, "room.scene_unlocked", { sceneId: action.sceneId, source: "host_event" });
      }
      if (action.type === "grant_clue") {
        publishRoomEvent(roomId, "room.clue_granted", {
          clueId: action.clueId,
          roleSlotId: action.roleSlotId,
          source: "host_event"
        });
      }
    }
    publishRoomEvent(roomId, "room.host_event_pending", { action: "executed", eventId });
    return { ok: true };
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

function extractTriggerPlayers(conditions) {
  const all = conditions?.all ?? [];
  const roleIds = all
    .map((condition) => condition.roleSlotId ?? condition.role_slot_id)
    .filter(Boolean);
  return [...new Set(roleIds)];
}
