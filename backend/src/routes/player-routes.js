import { pool, query, transaction } from "../db.js";
import { evaluateRoomRules } from "../rule-engine.js";
import { transactionWithEvents } from "../transaction-events.js";
import { publishRoomEvent } from "../room-event-bus.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { requireActor } from "../request-actor.js";
import { assertCapability } from "../capabilities.js";
import { fetchPlayerClues } from "./clue-helpers.js";
import { enrichPlayerSectionsWithPages } from "../section-pages.js";
import { assertRolesInRoomWorld } from "./clue-share-helpers.js";
import { listPlayerInventory, consumeItemIfNeeded } from "../inventory-helpers.js";
import { requireRoomRole } from "./route-guards.js";
import { sendErr, throwErr } from "../api-errors.js";
import { fetchPlayerHostConfirmStatus } from "./host-helpers.js";
import { prepareRoleSlotForJoin } from "../role-slot-runtime-helpers.js";
import {
  cluePlayerNoteSchema,
  clueShareRoomSchema,
  clueShareRolesSchema,
  completeSectionSchema,
  investigatePointSchema,
  inviteLookupSchema,
  joinRoomSchema,
  deleteNotebookEntrySchema,
  notebookEntrySchema,
  readClueSchema,
  roomIdParams
} from "./schemas.js";

async function playerDisplayName(query, roomId, roleSlotId) {
  const result = await query(
    `SELECT u.display_name, rs.name AS role_name
     FROM room_members rm
     JOIN users u ON u.id = rm.user_id
     JOIN role_slots rs ON rs.id = rm.role_slot_id
     WHERE rm.room_id = $1 AND rm.role_slot_id = $2 AND rm.status = 'active'`,
    [roomId, roleSlotId]
  );
  if (!result.rowCount) return "玩家";
  return result.rows[0].display_name || result.rows[0].role_name;
}

export async function registerPlayerRoutes(app) {
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
        `SELECT ss.id, ss.title, ss.body, ss.sequence, ss.metadata,
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
      const hostConfirm = await fetchPlayerHostConfirmStatus(
        client.query.bind(client),
        roomId,
        membership.role_slot_id
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
        hostConfirm
      };
    } finally {
      client.release();
    }
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

  app.get("/api/rooms/:roomId/exploration", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
    const scenes = await query(
      `SELECT s.id, s.name, s.public_text,
              COALESCE(json_agg(
                json_build_object(
                  'id', ip.id, 'name', ip.name, 'description', ip.description,
                  'interactionText', ip.interaction_text, 'resultText', ip.result_text,
                  'requiredItemId', ip.required_item_id,
                  'requiredItemName', req_item.name,
                  'hasRequiredItem', CASE
                    WHEN ip.required_item_id IS NULL THEN true
                    ELSE EXISTS (
                      SELECT 1 FROM inventory inv
                      WHERE inv.room_id = $1 AND inv.role_slot_id = $2
                        AND inv.item_id = ip.required_item_id AND inv.quantity > 0
                    )
                  END,
                  'investigated', (ir.investigated_at IS NOT NULL),
                  'investigatedAt', ir.investigated_at
                ) ORDER BY ip.sequence, ip.created_at
              ) FILTER (WHERE ip.id IS NOT NULL), '[]'::json) AS investigation_points
       FROM room_content_unlocks rcu
       JOIN scenes s ON s.id = rcu.content_id
       LEFT JOIN investigation_points ip ON ip.scene_id = s.id
         AND (ip.required_role_slot_id IS NULL OR ip.required_role_slot_id = $2)
       LEFT JOIN items req_item ON req_item.id = ip.required_item_id
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
    if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");

    return withRoomIdempotency(roomId, request, "player.investigate", async () => {
      const point = await query(
        `SELECT ip.*
         FROM investigation_points ip
         JOIN room_content_unlocks rcu ON rcu.content_id = ip.scene_id
          AND rcu.room_id = $1 AND rcu.content_type = 'scene'
         WHERE ip.id = $2
           AND (ip.required_role_slot_id IS NULL OR ip.required_role_slot_id = $3)`,
        [roomId, pointId, membership.role_slot_id]
      );
      if (!point.rowCount) return sendErr(reply, "INVESTIGATION_POINT_UNAVAILABLE");
      const target = point.rows[0];
      if (target.required_item_id) {
        const inventory = await query(
          `SELECT 1 FROM inventory WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3 AND quantity > 0`,
          [roomId, membership.role_slot_id, target.required_item_id]
        );
        if (!inventory.rowCount) {
          return sendErr(reply, "REQUIRED_ITEM_MISSING");
        }
      }
      await transactionWithEvents(async (client, queueEvent) => {
        await client.query(
          `INSERT INTO investigation_records (room_id, investigation_point_id, role_slot_id, result)
           VALUES ($1, $2, $3, jsonb_build_object('resultText', $4::text))
           ON CONFLICT (room_id, investigation_point_id, role_slot_id) DO NOTHING`,
          [roomId, pointId, membership.role_slot_id, target.result_text]
        );
        if (target.required_item_id) {
          await consumeItemIfNeeded(client, {
            roomId,
            roleSlotId: membership.role_slot_id,
            itemId: target.required_item_id
          });
        }
        if (target.clue_id) {
          await client.query(
            `INSERT INTO clue_ownership (room_id, role_slot_id, clue_id, metadata)
             VALUES ($1, $2, $3, jsonb_build_object('source', 'investigation', 'pointId', $4::text))
             ON CONFLICT (room_id, role_slot_id, clue_id) DO NOTHING`,
            [roomId, membership.role_slot_id, target.clue_id, pointId]
          );
          queueEvent(roomId, "room.clue_granted", {
            clueId: target.clue_id,
            roleSlotId: membership.role_slot_id,
            source: "investigation",
            pointId
          });
        }
        await client.query(
          `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
           VALUES ($1, $2, 'host', 'investigation_completed', $3, jsonb_build_object('pointId', $4::text))`,
          [roomId, actorId, `玩家调查了「${target.name}」`, pointId]
        );
        queueEvent(roomId, "room.investigation_completed", {
          pointId,
          roleSlotId: membership.role_slot_id
        });
      });
      const executedRules = await evaluateRoomRules(roomId);
      const clue = target.clue_id
        ? (await query(`SELECT id, name, public_text FROM clues WHERE id = $1`, [target.clue_id])).rows[0]
        : null;
      return { ok: true, resultText: target.result_text, clue, executedRules };
    });
  });

  app.post("/api/rooms/:roomId/clues/:clueId/read", { schema: readClueSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, clueId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");

    const clue = await query(`SELECT id, name FROM clues c JOIN rooms r ON r.world_id = c.world_id WHERE c.id = $1 AND r.id = $2`, [clueId, roomId]);
    if (!clue.rowCount) return sendErr(reply, "CLUE_NOT_FOUND");

    const owned = await query(
      `SELECT read_at FROM clue_ownership WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3`,
      [roomId, membership.role_slot_id, clueId]
    );
    const shared = !owned.rowCount
      ? await query(
          `SELECT 1 FROM clue_ownership
           WHERE room_id = $1 AND clue_id = $2
             AND (
               shared_with_room = true
               OR $3::uuid = ANY(COALESCE(shared_with_roles, '{}'))
             )`,
          [roomId, clueId, membership.role_slot_id]
        )
      : { rowCount: 0 };

    if (!owned.rowCount && !shared.rowCount) return sendErr(reply, "CLUE_NOT_ACCESSIBLE");

    const playerName = await playerDisplayName(query, roomId, membership.role_slot_id);
    const clueName = clue.rows[0].name;

    if (owned.rowCount) {
      const result = await query(
        `UPDATE clue_ownership SET read_at = COALESCE(read_at, now())
         WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3
         RETURNING read_at`,
        [roomId, membership.role_slot_id, clueId]
      );
      await query(
        `INSERT INTO clue_read_receipts (room_id, clue_id, role_slot_id, read_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (room_id, clue_id, role_slot_id) DO UPDATE SET read_at = COALESCE(clue_read_receipts.read_at, now())`,
        [roomId, clueId, membership.role_slot_id]
      );
      if (!owned.rows[0].read_at) {
        await query(
          `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
           VALUES ($1, $2, 'host', 'clue_read', $3, jsonb_build_object('clueId', $4::text, 'roleSlotId', $5::text))`,
          [roomId, actorId, `${playerName}阅读了线索「${clueName}」`, clueId, membership.role_slot_id]
        );
      }
      return { ok: true, readAt: result.rows[0].read_at };
    }

    const receipt = await query(
      `INSERT INTO clue_read_receipts (room_id, clue_id, role_slot_id, read_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (room_id, clue_id, role_slot_id) DO UPDATE SET read_at = COALESCE(clue_read_receipts.read_at, now())
       RETURNING read_at`,
      [roomId, clueId, membership.role_slot_id]
    );
    const existingReceipt = await query(
      `SELECT 1 FROM timeline_logs
       WHERE room_id = $1 AND event_type = 'clue_read' AND metadata->>'clueId' = $2 AND metadata->>'roleSlotId' = $3`,
      [roomId, clueId, membership.role_slot_id]
    );
    if (!existingReceipt.rowCount) {
      await query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'clue_read', $3, jsonb_build_object('clueId', $4::text, 'roleSlotId', $5::text, 'shared', true))`,
        [roomId, actorId, `${playerName}阅读了线索「${clueName}」`, clueId, membership.role_slot_id]
      );
    }
    return { ok: true, readAt: receipt.rows[0].read_at, shared: true };
  });

  app.post("/api/rooms/:roomId/clues/:clueId/share-room", { schema: clueShareRoomSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, clueId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
    const shared = request.body?.shared !== false;

    return withRoomIdempotency(roomId, request, "clues.share_room", async () => {
      const clue = await query(
        `SELECT c.name FROM clues c JOIN rooms r ON r.world_id = c.world_id WHERE c.id = $1 AND r.id = $2`,
        [clueId, roomId]
      );
      if (!clue.rowCount) return sendErr(reply, "CLUE_NOT_FOUND");

      const result = await transactionWithEvents(async (client, queueEvent) => {
        const updated = await client.query(
          `UPDATE clue_ownership
           SET shared_with_room = $4,
               shared_with_roles = CASE WHEN $4 THEN '{}'::uuid[] ELSE shared_with_roles END,
               shared_at = CASE WHEN $4 THEN COALESCE(shared_at, now()) ELSE NULL END
           WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3
           RETURNING shared_with_room, shared_at`,
          [roomId, membership.role_slot_id, clueId, shared]
        );
        if (!updated.rowCount) return null;

        const playerName = await playerDisplayName((text, params) => client.query(text, params), roomId, membership.role_slot_id);
        if (shared) {
          await client.query(
            `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
             VALUES ($1, $2, 'host', 'clue_shared_room', $3, jsonb_build_object('clueId', $4::text, 'roleSlotId', $5::text))`,
            [roomId, actorId, `${playerName}公开了线索「${clue.rows[0].name}」`, clueId, membership.role_slot_id]
          );
          queueEvent(roomId, "room.clue_granted", {
            clueId,
            roleSlotId: membership.role_slot_id,
            clueName: clue.rows[0].name,
            source: "shared_room"
          });
        }
        return updated.rows[0];
      });
      if (!result) return sendErr(reply, "CLUE_NOT_OWNED");

      return { ok: true, sharedWithRoom: result.shared_with_room, sharedAt: result.shared_at };
    });
  });

  app.post("/api/rooms/:roomId/clues/:clueId/share-roles", { schema: clueShareRolesSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, clueId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
    const roleSlotIds = request.body?.roleSlotIds ?? [];

    return withRoomIdempotency(roomId, request, "clues.share_roles", async () => {
      const clue = await query(
        `SELECT c.name FROM clues c JOIN rooms r ON r.world_id = c.world_id WHERE c.id = $1 AND r.id = $2`,
        [clueId, roomId]
      );
      if (!clue.rowCount) return sendErr(reply, "CLUE_NOT_FOUND");

      let targets;
      try {
        targets = await assertRolesInRoomWorld(query, roomId, roleSlotIds, {
          excludeRoleSlotId: membership.role_slot_id
        });
      } catch (error) {
        if (error.code === "ROLE_SLOT_WORLD_MISMATCH") return sendErr(reply, "ROLE_SLOT_WORLD_MISMATCH");
        throw error;
      }

      const result = await transactionWithEvents(async (client, queueEvent) => {
        const updated = await client.query(
          `UPDATE clue_ownership
           SET shared_with_roles = $4::uuid[],
               shared_with_room = false,
               shared_at = CASE WHEN cardinality($4::uuid[]) > 0 THEN COALESCE(shared_at, now()) ELSE NULL END
           WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3
           RETURNING shared_with_roles, shared_at`,
          [roomId, membership.role_slot_id, clueId, targets]
        );
        if (!updated.rowCount) return null;

        const playerName = await playerDisplayName(
          (text, params) => client.query(text, params),
          roomId,
          membership.role_slot_id
        );
        if (targets.length) {
          await client.query(
            `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
             VALUES ($1, $2, 'host', 'clue_shared_roles', $3, jsonb_build_object('clueId', $4::text, 'roleSlotId', $5::text, 'targetRoleSlotIds', $6::jsonb))`,
            [
              roomId,
              actorId,
              `${playerName}私享线索「${clue.rows[0].name}」给 ${targets.length} 名玩家`,
              clueId,
              membership.role_slot_id,
              JSON.stringify(targets)
            ]
          );
          for (const targetId of targets) {
            queueEvent(roomId, "room.clue_granted", {
              clueId,
              roleSlotId: targetId,
              clueName: clue.rows[0].name,
              source: "shared_roles",
              ownerRoleSlotId: membership.role_slot_id
            });
          }
        }
        return updated.rows[0];
      });
      if (!result) return sendErr(reply, "CLUE_NOT_OWNED");

      return { ok: true, sharedWithRoles: result.shared_with_roles, sharedAt: result.shared_at };
    });
  });

  app.patch("/api/rooms/:roomId/clues/:clueId/player-note", { schema: cluePlayerNoteSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, clueId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
    const { note = "" } = request.body ?? {};

    const result = await query(
      `UPDATE clue_ownership SET player_note = $4
       WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3
       RETURNING player_note`,
      [roomId, membership.role_slot_id, clueId, note]
    );
    if (!result.rowCount) return sendErr(reply, "CLUE_NOT_OWNED");
    return { ok: true, playerNote: result.rows[0].player_note };
  });
}
