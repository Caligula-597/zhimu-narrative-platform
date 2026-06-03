import { query, transaction } from "../db.js";
import { evaluateRoomRules } from "../rule-engine.js";
import { publishRoomEvent } from "../room-event-bus.js";
import { requireActor } from "../request-actor.js";
import { requireRoomRole } from "./route-guards.js";
import {
  completeSectionSchema,
  investigatePointSchema,
  inviteLookupSchema,
  joinRoomSchema,
  notebookEntrySchema,
  readClueSchema,
  roomIdParams
} from "./schemas.js";

export async function registerPlayerRoutes(app) {
  app.get("/api/rooms/invite/:inviteCode", { schema: inviteLookupSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const room = await query(
      `SELECT r.id, r.name, r.status, w.id AS world_id, w.name AS world_name
       FROM rooms r JOIN worlds w ON w.id = r.world_id
       WHERE r.invite_code = $1`,
      [request.params.inviteCode]
    );
    if (!room.rowCount) return reply.code(404).send({ error: "Room not found" });
    const roles = await query(
      `SELECT rs.id, rs.name, rs.public_profile,
              EXISTS (
                SELECT 1 FROM room_members rm
                WHERE rm.room_id = $1 AND rm.role_slot_id = rs.id AND rm.status = 'active'
              ) AS occupied,
              EXISTS (
                SELECT 1 FROM room_members rm
                WHERE rm.room_id = $1 AND rm.role_slot_id = rs.id
                  AND rm.user_id = $3 AND rm.status = 'active'
              ) AS occupied_by_current
       FROM role_slots rs
       WHERE rs.world_id = $2
       ORDER BY rs.sequence`,
      [room.rows[0].id, room.rows[0].world_id, actorId]
    );
    return {
      room: { id: room.rows[0].id, name: room.rows[0].name, status: room.rows[0].status },
      world: { id: room.rows[0].world_id, name: room.rows[0].world_name },
      roles: roles.rows
    };
  });

  app.post("/api/rooms/join", { schema: joinRoomSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { inviteCode, roleSlotId } = request.body ?? {};
    if (!inviteCode || !roleSlotId) return reply.code(400).send({ error: "inviteCode and roleSlotId are required" });
    const room = await query(`SELECT id, world_id FROM rooms WHERE invite_code = $1`, [inviteCode]);
    if (!room.rowCount) return reply.code(404).send({ error: "Room not found" });
    const role = await query(`SELECT 1 FROM role_slots WHERE id = $1 AND world_id = $2`, [roleSlotId, room.rows[0].world_id]);
    if (!role.rowCount) return reply.code(400).send({ error: "Role slot not found in room world" });
    const occupied = await query(
      `SELECT 1 FROM room_members
       WHERE room_id = $1 AND role_slot_id = $2 AND user_id <> $3 AND status = 'active'`,
      [room.rows[0].id, roleSlotId, actorId]
    );
    if (occupied.rowCount) return reply.code(409).send({ error: "Role slot already occupied" });
    await query(
      `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id)
       VALUES ($1, $2, 'player', $3)
       ON CONFLICT (room_id, user_id)
       DO UPDATE SET role_slot_id = EXCLUDED.role_slot_id, status = 'active'`,
      [room.rows[0].id, actorId, roleSlotId]
    );
    const roleInfo = await query(`SELECT name FROM role_slots WHERE id = $1`, [roleSlotId]);
    publishRoomEvent(room.rows[0].id, "room.player_joined", {
      roleSlotId,
      roleName: roleInfo.rows[0]?.name ?? "玩家角色"
    });
    return { ok: true, roomId: room.rows[0].id };
  });

  app.get("/api/rooms/:roomId/player-home", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) {
      const error = new Error("Player role selection required");
      error.statusCode = 409;
      throw error;
    }

    const [role, sections, notes, clues, rooms, members] = await Promise.all([
      query(`SELECT id, name, public_profile, private_profile FROM role_slots WHERE id = $1`, [membership.role_slot_id]),
      query(
        `SELECT ss.id, ss.title, ss.body, ss.sequence,
                rp.started_at, rp.completed_at,
                (rp.completed_at IS NOT NULL) AS completed
         FROM script_sections ss
         JOIN rooms room ON room.id = $1
         LEFT JOIN reading_progress rp
           ON rp.script_section_id = ss.id AND rp.room_id = $1 AND rp.role_slot_id = $2
         WHERE ss.role_slot_id = $2
           AND (
             ss.publication_status = 'published'
             OR (room.status = 'testing' AND ss.publication_status = 'testing')
           )
           AND (
             ss.sequence = 1 OR EXISTS (
               SELECT 1 FROM room_content_unlocks rcu
               WHERE rcu.room_id = $1 AND rcu.content_type = 'script_section' AND rcu.content_id = ss.id
             )
           )
         ORDER BY ss.sequence`,
        [roomId, membership.role_slot_id]
      ),
      query(
        `SELECT id, source_type, source_id, title, body, created_at
         FROM notebook_entries
         WHERE room_id = $1 AND role_slot_id = $2
         ORDER BY created_at DESC`,
        [roomId, membership.role_slot_id]
      ),
      query(
        `SELECT c.id, c.name, c.public_text, co.acquired_at, co.read_at
         FROM clue_ownership co JOIN clues c ON c.id = co.clue_id
         WHERE co.room_id = $1 AND co.role_slot_id = $2
         ORDER BY co.acquired_at DESC`,
        [roomId, membership.role_slot_id]
      ),
      query(
        `SELECT vr.id, vr.name, vr.room_type, vr.status
         FROM voice_rooms vr
         WHERE vr.room_id = $1 AND (
           vr.room_type = 'public' OR EXISTS (
             SELECT 1 FROM voice_room_members vrm
             WHERE vrm.voice_room_id = vr.id AND vrm.user_id = $2
           )
         ) ORDER BY vr.created_at`,
        [roomId, actorId]
      ),
      query(
        `SELECT rs.id AS role_slot_id, rs.name AS role_name, rm.user_id, u.display_name,
                rm.member_type, (rm.user_id IS NOT NULL) AS online
         FROM rooms r
         JOIN role_slots rs ON rs.world_id = r.world_id
         LEFT JOIN room_members rm
           ON rm.room_id = r.id AND rm.role_slot_id = rs.id AND rm.status = 'active'
         LEFT JOIN users u ON u.id = rm.user_id
         WHERE r.id = $1
         ORDER BY rs.sequence`,
        [roomId]
      )
    ]);

    return { role: role.rows[0], sections: sections.rows, notes: notes.rows, clues: clues.rows, voiceRooms: rooms.rows, roomMembers: members.rows };
  });

  app.post("/api/rooms/:roomId/sections/:sectionId/complete", { schema: completeSectionSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, sectionId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throw Object.assign(new Error("Player role required"), { statusCode: 409 });
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
    if (!section.rowCount) throw Object.assign(new Error("Script section is locked or unavailable"), { statusCode: 404 });

    await transaction(async (client) => {
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
    });
    publishRoomEvent(roomId, "room.section_completed", {
      sectionId,
      roleSlotId: membership.role_slot_id
    });
    const executedRules = await evaluateRoomRules(roomId);
    return { ok: true, executedRules };
  });

  app.post("/api/rooms/:roomId/notebook", { schema: notebookEntrySchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throw Object.assign(new Error("Player role required"), { statusCode: 409 });
    const { sourceType, sourceId, title, body } = request.body ?? {};
    if (!sourceType || !title || !body) return reply.code(400).send({ error: "sourceType, title and body are required" });
    const result = await query(
      `INSERT INTO notebook_entries (room_id, role_slot_id, created_by_user_id, source_type, source_id, title, body)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [roomId, membership.role_slot_id, actorId, sourceType, sourceId ?? null, title, body]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.get("/api/rooms/:roomId/exploration", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throw Object.assign(new Error("Player role required"), { statusCode: 409 });
    const scenes = await query(
      `SELECT s.id, s.name, s.public_text,
              COALESCE(json_agg(
                json_build_object(
                  'id', ip.id, 'name', ip.name, 'description', ip.description,
                  'interactionText', ip.interaction_text, 'resultText', ip.result_text,
                  'investigated', (ir.investigated_at IS NOT NULL),
                  'investigatedAt', ir.investigated_at
                ) ORDER BY ip.sequence, ip.created_at
              ) FILTER (WHERE ip.id IS NOT NULL), '[]'::json) AS investigation_points
       FROM room_content_unlocks rcu
       JOIN scenes s ON s.id = rcu.content_id
       LEFT JOIN investigation_points ip ON ip.scene_id = s.id
         AND (ip.required_role_slot_id IS NULL OR ip.required_role_slot_id = $2)
       LEFT JOIN investigation_records ir ON ir.room_id = $1
         AND ir.investigation_point_id = ip.id AND ir.role_slot_id = $2
       WHERE rcu.room_id = $1 AND rcu.content_type = 'scene'
       GROUP BY s.id, s.name, s.public_text, rcu.unlocked_at
       ORDER BY rcu.unlocked_at, s.created_at`,
      [roomId, membership.role_slot_id]
    );
    return { scenes: scenes.rows };
  });

  app.post("/api/rooms/:roomId/investigation-points/:pointId/investigate", { schema: investigatePointSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, pointId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throw Object.assign(new Error("Player role required"), { statusCode: 409 });
    const point = await query(
      `SELECT ip.*
       FROM investigation_points ip
       JOIN room_content_unlocks rcu ON rcu.content_id = ip.scene_id
        AND rcu.room_id = $1 AND rcu.content_type = 'scene'
       WHERE ip.id = $2
         AND (ip.required_role_slot_id IS NULL OR ip.required_role_slot_id = $3)`,
      [roomId, pointId, membership.role_slot_id]
    );
    if (!point.rowCount) return reply.code(404).send({ error: "Investigation point is locked or unavailable" });
    const target = point.rows[0];
    if (target.required_item_id) {
      const inventory = await query(
        `SELECT 1 FROM inventory WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3 AND quantity > 0`,
        [roomId, membership.role_slot_id, target.required_item_id]
      );
      if (!inventory.rowCount) return reply.code(409).send({ error: "Required item is missing" });
    }
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO investigation_records (room_id, investigation_point_id, role_slot_id, result)
         VALUES ($1, $2, $3, jsonb_build_object('resultText', $4::text))
         ON CONFLICT (room_id, investigation_point_id, role_slot_id) DO NOTHING`,
        [roomId, pointId, membership.role_slot_id, target.result_text]
      );
      if (target.clue_id) {
        await client.query(
          `INSERT INTO clue_ownership (room_id, role_slot_id, clue_id, metadata)
           VALUES ($1, $2, $3, jsonb_build_object('source', 'investigation', 'pointId', $4::text))
           ON CONFLICT (room_id, role_slot_id, clue_id) DO NOTHING`,
          [roomId, membership.role_slot_id, target.clue_id, pointId]
        );
      }
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'investigation_completed', $3, jsonb_build_object('pointId', $4::text))`,
        [roomId, actorId, `玩家调查了「${target.name}」`, pointId]
      );
    });
    if (target.clue_id) {
      publishRoomEvent(roomId, "room.clue_granted", {
        clueId: target.clue_id,
        roleSlotId: membership.role_slot_id,
        source: "investigation",
        pointId
      });
    }
    const executedRules = await evaluateRoomRules(roomId);
    const clue = target.clue_id
      ? (await query(`SELECT id, name, public_text FROM clues WHERE id = $1`, [target.clue_id])).rows[0]
      : null;
    return { ok: true, resultText: target.result_text, clue, executedRules };
  });

  app.post("/api/rooms/:roomId/clues/:clueId/read", { schema: readClueSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, clueId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throw Object.assign(new Error("Player role required"), { statusCode: 409 });
    const result = await query(
      `UPDATE clue_ownership SET read_at = COALESCE(read_at, now())
       WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3
       RETURNING read_at`,
      [roomId, membership.role_slot_id, clueId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Clue not owned" });
    return { ok: true, readAt: result.rows[0].read_at };
  });
}
