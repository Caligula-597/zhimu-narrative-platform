import { pool, query, transaction } from "../db.js";
import { publishRoomEvent } from "../room-event-bus.js";
import { requireActor } from "../request-actor.js";
import { assertCapability } from "../capabilities.js";
import { fetchPlayerClues } from "./clue-helpers.js";
import { enrichPlayerSectionsWithPages } from "../section-pages.js";
import { listPlayerInventory } from "../inventory-helpers.js";
import { requireRoomRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import { fetchPlayerHostConfirmStatus } from "./host-helpers.js";
import { prepareRoleSlotForJoin } from "../role-slot-runtime-helpers.js";
import { inviteLookupSchema, joinRoomSchema, roomIdParams } from "./schemas.js";
import { resolveCurrentActKey, fetchPlayerTasksForRoom } from "../player-tasks.js";
import { fetchPlayerSuspicions } from "../player-suspicions.js";
import { fetchMyTestimonies } from "../testimonies.js";
import { fetchCurrentMiniGame } from "../room-mini-games.js";

export async function registerPlayerAccessRoutes(app) {

  app.get("/api/rooms/invite/:inviteCode", { schema: inviteLookupSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const room = await query(
      `SELECT r.id, r.name, r.status, w.id AS world_id, w.name AS world_name
       FROM rooms r JOIN worlds w ON w.id = r.world_id
       WHERE r.invite_code = $1`,
      [request.params.inviteCode]
    );
    if (!room.rowCount) return sendErr(reply, "ROOM_NOT_FOUND");
    const bound = await query(
      `SELECT role_slot_id FROM room_members
       WHERE room_id = $1 AND user_id = $2 AND status = 'active' AND role_slot_id IS NOT NULL`,
      [room.rows[0].id, actorId]
    );
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
      current_role_slot_id: bound.rows[0]?.role_slot_id ?? null,
      roles: roles.rows
    };
  });

  app.post("/api/rooms/join", { schema: joinRoomSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    await assertCapability(actorId, "room.join");
    const { inviteCode, roleSlotId } = request.body ?? {};
    if (!inviteCode || !roleSlotId) return sendErr(reply, "INVITE_FIELDS_REQUIRED");
    let roomId;
    try {
      roomId = await transaction(async (client) => {
        const room = await client.query(`SELECT id, world_id FROM rooms WHERE invite_code = $1`, [inviteCode]);
        if (!room.rowCount) {
          const err = new Error("ROOM_NOT_FOUND");
          err.code = "ROOM_NOT_FOUND";
          throw err;
        }
        const role = await client.query(
          `SELECT 1 FROM role_slots WHERE id = $1 AND world_id = $2`,
          [roleSlotId, room.rows[0].world_id]
        );
        if (!role.rowCount) {
          const err = new Error("ROLE_SLOT_WORLD_MISMATCH");
          err.code = "ROLE_SLOT_WORLD_MISMATCH";
          throw err;
        }
        const existing = await client.query(
          `SELECT role_slot_id FROM room_members
           WHERE room_id = $1 AND user_id = $2 AND status = 'active'
           FOR UPDATE`,
          [room.rows[0].id, actorId]
        );
        const boundRoleId = existing.rows[0]?.role_slot_id ?? null;
        if (boundRoleId) {
          if (boundRoleId === roleSlotId) {
            return room.rows[0].id;
          }
          const err = new Error("ROLE_ALREADY_BOUND");
          err.code = "ROLE_ALREADY_BOUND";
          throw err;
        }
        const occupied = await client.query(
          `SELECT 1 FROM room_members
           WHERE room_id = $1 AND role_slot_id = $2 AND user_id <> $3 AND status = 'active'
           FOR UPDATE`,
          [room.rows[0].id, roleSlotId, actorId]
        );
        if (occupied.rowCount) {
          const err = new Error("ROLE_SLOT_OCCUPIED");
          err.code = "ROLE_SLOT_OCCUPIED";
          throw err;
        }
        await prepareRoleSlotForJoin(client, room.rows[0].id, roleSlotId, actorId);
        await client.query(
          `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id)
           VALUES ($1, $2, 'player', $3)
           ON CONFLICT (room_id, user_id)
           DO UPDATE SET role_slot_id = EXCLUDED.role_slot_id, status = 'active'`,
          [room.rows[0].id, actorId, roleSlotId]
        );
        return room.rows[0].id;
      });
    } catch (error) {
      if (error.code === "ROLE_ALREADY_BOUND") {
        return sendErr(reply, "ROLE_ALREADY_BOUND");
      }
      if (error.code === "ROLE_SLOT_OCCUPIED" || error.code === "23505") {
        return sendErr(reply, "ROLE_SLOT_OCCUPIED", "该角色席位已被其他玩家占用。");
      }
      if (error.code === "ROOM_NOT_FOUND") return sendErr(reply, "ROOM_NOT_FOUND");
      if (error.code === "ROLE_SLOT_WORLD_MISMATCH") return sendErr(reply, "ROLE_SLOT_WORLD_MISMATCH");
      throw error;
    }
    const roleInfo = await query(`SELECT name FROM role_slots WHERE id = $1`, [roleSlotId]);
    publishRoomEvent(roomId, "room.player_joined", {
      roleSlotId,
      roleName: roleInfo.rows[0]?.name ?? "玩家角色"
    }).catch(() => {});
    return { ok: true, roomId };
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

    const client = await pool.connect();
    try {
      const roomInfo = await client.query(`SELECT id, name, invite_code, status FROM rooms WHERE id = $1`, [roomId]);
      const role = await client.query(`SELECT id, name, public_profile, private_profile FROM role_slots WHERE id = $1`, [membership.role_slot_id]);
      const sections = await client.query(
        `SELECT ss.id, ss.title, ss.body, ss.sequence, ss.chapter_id, ss.metadata,
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
      );
      const notes = await client.query(
        `SELECT id, source_type, source_id, title, body, created_at
         FROM notebook_entries
         WHERE room_id = $1 AND role_slot_id = $2
         ORDER BY created_at DESC`,
        [roomId, membership.role_slot_id]
      );
      const clueBundle = await fetchPlayerClues(client.query.bind(client), roomId, membership.role_slot_id);
      const rooms = await client.query(
        `SELECT vr.id, vr.name, vr.room_type, vr.status
         FROM voice_rooms vr
         WHERE vr.room_id = $1 AND (
           vr.room_type = 'public' OR EXISTS (
             SELECT 1 FROM voice_room_members vrm
             WHERE vrm.voice_room_id = vr.id AND vrm.user_id = $2
           )
         ) ORDER BY vr.created_at`,
        [roomId, actorId]
      );
      const members = await client.query(
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
      );
      const inventory = await listPlayerInventory(client, roomId, membership.role_slot_id);
      const enrichedSections = await enrichPlayerSectionsWithPages(client, sections.rows);
      const segments = await client.query(
        `SELECT ws.id, ws.segment_key, ws.title, ws.sequence, ws.chapter_id,
                ws.story->'playerTasks' AS player_tasks,
                ws.mechanics->'endCondition' AS end_condition,
                ws.operations->'playerTips' AS player_tips
         FROM world_segments ws
         JOIN rooms r ON r.world_id = ws.world_id
         WHERE r.id = $1
         ORDER BY ws.sequence, ws.created_at`,
        [roomId]
      );
      const hostConfirm = await fetchPlayerHostConfirmStatus(
        client.query.bind(client),
        roomId,
        membership.role_slot_id
      );
      const currentGame = await fetchCurrentMiniGame(client.query.bind(client), roomId);
      const currentActKey = resolveCurrentActKey(enrichedSections, segments.rows);
      const tasks = await fetchPlayerTasksForRoom(
        client.query.bind(client),
        roomId,
        membership.role_slot_id,
        currentActKey
      );
      const suspicions = await fetchPlayerSuspicions(
        client.query.bind(client),
        roomId,
        membership.role_slot_id
      );
      const testimonies = await fetchMyTestimonies(
        client.query.bind(client),
        roomId,
        membership.role_slot_id
      );
      const activeVotes = await client.query(
        `SELECT rv.id, rv.title, rv.prompt, rv.vote_type, rv.visibility, rv.status,
                COALESCE(json_agg(jsonb_build_object(
                  'id', rvo.id,
                  'roleSlotId', rvo.role_slot_id,
                  'label', rvo.label,
                  'description', rvo.description,
                  'sequence', rvo.sequence
                ) ORDER BY rvo.sequence) FILTER (WHERE rvo.id IS NOT NULL), '[]'::json) AS options,
                MAX(rvb.submitted_at) AS submitted_at
         FROM room_votes rv
         LEFT JOIN room_vote_options rvo ON rvo.vote_id = rv.id
         LEFT JOIN room_vote_ballots rvb ON rvb.vote_id = rv.id AND rvb.role_slot_id = $2
         WHERE rv.room_id = $1 AND rv.status IN ('open', 'closed', 'published')
         GROUP BY rv.id
         ORDER BY rv.created_at DESC`,
        [roomId, membership.role_slot_id]
      );
      const privateActions = await client.query(
        `SELECT id, segment_id, target_role_slot_id, action_type, title, body, payload,
                status, host_response, visibility, created_at, updated_at
         FROM room_private_actions
         WHERE room_id = $1 AND (
           actor_role_slot_id = $2
           OR (visibility = 'actor_target_host' AND target_role_slot_id = $2)
         )
         ORDER BY created_at DESC
         LIMIT 50`,
        [roomId, membership.role_slot_id]
      );
      const roleState = await client.query(
        `SELECT faction_key, public_alias, hidden_identity, variables, updated_at
         FROM room_role_states
         WHERE room_id = $1 AND role_slot_id = $2`,
        [roomId, membership.role_slot_id]
      );
      return {
        room: roomInfo.rows[0],
        role: role.rows[0],
        sections: enrichedSections,
        notes: notes.rows,
        clues: clueBundle.owned,
        sharedClues: clueBundle.shared,
        voiceRooms: rooms.rows,
        roomMembers: members.rows,
        inventory,
        hostConfirm,
        currentGame,
        currentActKey,
        tasks,
        suspicions,
        testimonies,
        activeVotes: activeVotes.rows,
        privateActions: privateActions.rows,
        roleState: roleState.rows[0] ?? null,
        segments: segments.rows
      };
    } finally {
      client.release();
    }
  });
}
