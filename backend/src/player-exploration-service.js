import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { assertRolesInRoomWorld } from "./routes/clue-share-helpers.js";
import { consumeItemIfNeeded } from "./inventory-helpers.js";
import { playerDisplayName } from "./routes/player-route-helpers.js";
import { evaluateRoomRules } from "./rule-engine.js";
import { transactionWithEvents } from "./transaction-events.js";

export async function loadPlayerExploration(roomId, roleSlotId) {
  const scenes = await query(
    `SELECT s.id, s.name, s.public_text,
            COALESCE(json_agg(
              json_build_object(
                'id', ip.id, 'name', ip.name, 'description', ip.description,
                'interactionText', ip.interaction_text,
                'resultText', CASE WHEN ir.investigated_at IS NOT NULL THEN ip.result_text ELSE NULL END,
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
    [roomId, roleSlotId]
  );
  return { scenes: scenes.rows };
}

export async function investigatePlayerPoint({ roomId, pointId, roleSlotId, actorId }) {
  const point = await query(
    `SELECT ip.*
     FROM investigation_points ip
     JOIN room_content_unlocks rcu ON rcu.content_id = ip.scene_id
      AND rcu.room_id = $1 AND rcu.content_type = 'scene'
     WHERE ip.id = $2
       AND (ip.required_role_slot_id IS NULL OR ip.required_role_slot_id = $3)`,
    [roomId, pointId, roleSlotId]
  );
  if (!point.rowCount) throwErr("INVESTIGATION_POINT_UNAVAILABLE");
  const target = point.rows[0];
  if (target.required_item_id) {
    const inventory = await query(
      `SELECT 1 FROM inventory WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3 AND quantity > 0`,
      [roomId, roleSlotId, target.required_item_id]
    );
    if (!inventory.rowCount) throwErr("REQUIRED_ITEM_MISSING");
  }

  await transactionWithEvents(async (client, queueEvent) => {
    await client.query(
      `INSERT INTO investigation_records (room_id, investigation_point_id, role_slot_id, result)
       VALUES ($1, $2, $3, jsonb_build_object('resultText', $4::text))
       ON CONFLICT (room_id, investigation_point_id, role_slot_id) DO NOTHING`,
      [roomId, pointId, roleSlotId, target.result_text]
    );
    if (target.required_item_id) {
      await consumeItemIfNeeded(client, { roomId, roleSlotId, itemId: target.required_item_id });
    }
    if (target.clue_id) {
      await client.query(
        `INSERT INTO clue_ownership (room_id, role_slot_id, clue_id, metadata)
         VALUES ($1, $2, $3, jsonb_build_object('source', 'investigation', 'pointId', $4::text))
         ON CONFLICT (room_id, role_slot_id, clue_id) DO NOTHING`,
        [roomId, roleSlotId, target.clue_id, pointId]
      );
      queueEvent(roomId, "room.clue_granted", {
        clueId: target.clue_id,
        roleSlotId,
        source: "investigation",
        pointId
      });
    }
    await client.query(
      `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
       VALUES ($1, $2, 'host', 'investigation_completed', $3, jsonb_build_object('pointId', $4::text))`,
      [roomId, actorId, `玩家调查了「${target.name}」`, pointId]
    );
    queueEvent(roomId, "room.investigation_completed", { pointId, roleSlotId });
  });

  const executedRules = await evaluateRoomRules(roomId);
  const clue = target.clue_id
    ? (await query(`SELECT id, name, public_text FROM clues WHERE id = $1`, [target.clue_id])).rows[0]
    : null;
  return { ok: true, resultText: target.result_text, clue, executedRules };
}

export async function readPlayerClue({ roomId, clueId, roleSlotId, actorId }) {
  const clue = await query(
    `SELECT id, name FROM clues c JOIN rooms r ON r.world_id = c.world_id WHERE c.id = $1 AND r.id = $2`,
    [clueId, roomId]
  );
  if (!clue.rowCount) throwErr("CLUE_NOT_FOUND");
  const owned = await query(
    `SELECT read_at FROM clue_ownership WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3`,
    [roomId, roleSlotId, clueId]
  );
  const shared = !owned.rowCount
    ? await query(
        `SELECT 1 FROM clue_ownership
         WHERE room_id = $1 AND clue_id = $2
           AND (shared_with_room = true OR $3::uuid = ANY(COALESCE(shared_with_roles, '{}')))`,
        [roomId, clueId, roleSlotId]
      )
    : { rowCount: 0 };
  if (!owned.rowCount && !shared.rowCount) throwErr("CLUE_NOT_ACCESSIBLE");

  const playerName = await playerDisplayName(query, roomId, roleSlotId);
  const clueName = clue.rows[0].name;
  if (owned.rowCount) {
    const result = await query(
      `UPDATE clue_ownership SET read_at = COALESCE(read_at, now())
       WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3 RETURNING read_at`,
      [roomId, roleSlotId, clueId]
    );
    await query(
      `INSERT INTO clue_read_receipts (room_id, clue_id, role_slot_id, read_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (room_id, clue_id, role_slot_id) DO UPDATE SET read_at = COALESCE(clue_read_receipts.read_at, now())`,
      [roomId, clueId, roleSlotId]
    );
    if (!owned.rows[0].read_at) {
      await query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'clue_read', $3, jsonb_build_object('clueId', $4::text, 'roleSlotId', $5::text))`,
        [roomId, actorId, `${playerName}阅读了线索「${clueName}」`, clueId, roleSlotId]
      );
    }
    return { ok: true, readAt: result.rows[0].read_at };
  }

  const receipt = await query(
    `INSERT INTO clue_read_receipts (room_id, clue_id, role_slot_id, read_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (room_id, clue_id, role_slot_id) DO UPDATE SET read_at = COALESCE(clue_read_receipts.read_at, now())
     RETURNING read_at`,
    [roomId, clueId, roleSlotId]
  );
  const existingLog = await query(
    `SELECT 1 FROM timeline_logs
     WHERE room_id = $1 AND event_type = 'clue_read' AND metadata->>'clueId' = $2 AND metadata->>'roleSlotId' = $3`,
    [roomId, clueId, roleSlotId]
  );
  if (!existingLog.rowCount) {
    await query(
      `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
       VALUES ($1, $2, 'host', 'clue_read', $3, jsonb_build_object('clueId', $4::text, 'roleSlotId', $5::text, 'shared', true))`,
      [roomId, actorId, `${playerName}阅读了线索「${clueName}」`, clueId, roleSlotId]
    );
  }
  return { ok: true, readAt: receipt.rows[0].read_at, shared: true };
}

async function requireRoomClueName(roomId, clueId) {
  const clue = await query(
    `SELECT c.name FROM clues c JOIN rooms r ON r.world_id = c.world_id WHERE c.id = $1 AND r.id = $2`,
    [clueId, roomId]
  );
  if (!clue.rowCount) throwErr("CLUE_NOT_FOUND");
  return clue.rows[0].name;
}

export async function sharePlayerClueWithRoom({ roomId, clueId, roleSlotId, actorId, shared }) {
  const clueName = await requireRoomClueName(roomId, clueId);
  const result = await transactionWithEvents(async (client, queueEvent) => {
    const updated = await client.query(
      `UPDATE clue_ownership
       SET shared_with_room = $4,
           shared_with_roles = CASE WHEN $4 THEN '{}'::uuid[] ELSE shared_with_roles END,
           shared_at = CASE WHEN $4 THEN COALESCE(shared_at, now()) ELSE NULL END
       WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3
       RETURNING shared_with_room, shared_at`,
      [roomId, roleSlotId, clueId, shared]
    );
    if (!updated.rowCount) return null;
    const playerName = await playerDisplayName(client.query.bind(client), roomId, roleSlotId);
    if (shared) {
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'clue_shared_room', $3, jsonb_build_object('clueId', $4::text, 'roleSlotId', $5::text))`,
        [roomId, actorId, `${playerName}公开了线索「${clueName}」`, clueId, roleSlotId]
      );
      queueEvent(roomId, "room.clue_granted", { clueId, roleSlotId, clueName, source: "shared_room" });
    }
    return updated.rows[0];
  });
  if (!result) throwErr("CLUE_NOT_OWNED");
  return { ok: true, sharedWithRoom: result.shared_with_room, sharedAt: result.shared_at };
}

export async function sharePlayerClueWithRoles({ roomId, clueId, roleSlotId, actorId, roleSlotIds }) {
  const clueName = await requireRoomClueName(roomId, clueId);
  let targets;
  try {
    targets = await assertRolesInRoomWorld(query, roomId, roleSlotIds, { excludeRoleSlotId: roleSlotId });
  } catch (error) {
    if (error.code === "ROLE_SLOT_WORLD_MISMATCH") throwErr("ROLE_SLOT_WORLD_MISMATCH");
    throw error;
  }
  const result = await transactionWithEvents(async (client, queueEvent) => {
    const updated = await client.query(
      `UPDATE clue_ownership
       SET shared_with_roles = $4::uuid[], shared_with_room = false,
           shared_at = CASE WHEN cardinality($4::uuid[]) > 0 THEN COALESCE(shared_at, now()) ELSE NULL END
       WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3
       RETURNING shared_with_roles, shared_at`,
      [roomId, roleSlotId, clueId, targets]
    );
    if (!updated.rowCount) return null;
    const playerName = await playerDisplayName(client.query.bind(client), roomId, roleSlotId);
    if (targets.length) {
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'clue_shared_roles', $3,
                 jsonb_build_object('clueId', $4::text, 'roleSlotId', $5::text, 'targetRoleSlotIds', $6::jsonb))`,
        [roomId, actorId, `${playerName}私享线索「${clueName}」给 ${targets.length} 名玩家`, clueId, roleSlotId, JSON.stringify(targets)]
      );
      for (const targetId of targets) {
        queueEvent(roomId, "room.clue_granted", {
          clueId,
          roleSlotId: targetId,
          clueName,
          source: "shared_roles",
          ownerRoleSlotId: roleSlotId
        });
      }
    }
    return updated.rows[0];
  });
  if (!result) throwErr("CLUE_NOT_OWNED");
  return { ok: true, sharedWithRoles: result.shared_with_roles, sharedAt: result.shared_at };
}

export async function updatePlayerClueNote({ roomId, clueId, roleSlotId, note }) {
  const result = await query(
    `UPDATE clue_ownership SET player_note = $4
     WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3 RETURNING player_note`,
    [roomId, roleSlotId, clueId, note]
  );
  if (!result.rowCount) throwErr("CLUE_NOT_OWNED");
  return { ok: true, playerNote: result.rows[0].player_note };
}
