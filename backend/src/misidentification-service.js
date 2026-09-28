// Misidentification Editor — service layer
// CRUD for the misidentification register (mistaken beliefs, bound to evidence).

import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

const TABLE = "world_misidentifications";
const RETURN_COLS = [
  "id", "world_id", "act_id", "timestamp", "sort_order",
  "holder_id", "holder_label", "title", "content", "truth",
  "refuted_by_clue_id", "refuted_by_item_id", "refuted_at",
  "duration", "is_active", "created_at", "updated_at"
].join(", ");

const COLS = [
  "world_id", "act_id", "timestamp", "sort_order",
  "holder_id", "holder_label", "title", "content", "truth",
  "refuted_by_clue_id", "refuted_by_item_id", "refuted_at",
  "duration", "is_active"
];

const WIRE_KEYS = [
  "actId", "timestamp", "sortOrder",
  "holderId", "holderLabel", "title", "content", "truth",
  "refutedByClueId", "refutedByItemId", "refutedAt",
  "duration", "isActive"
];

// Order in which WIRE_KEYS map to COLS (index-aligned).
const FIELD_SETS = WIRE_KEYS.map((key, i) => [COLS[i], key]);

function rowToMisidentification(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    actId: row.act_id,
    timestamp: row.timestamp,
    sortOrder: row.sort_order,
    holderId: row.holder_id,
    holderLabel: row.holder_label,
    title: row.title,
    content: row.content,
    truth: row.truth,
    refutedByClueId: row.refuted_by_clue_id,
    refutedByItemId: row.refuted_by_item_id,
    refutedAt: row.refuted_at,
    duration: row.duration,
    isActive: row.is_active,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function rowsToMisidentifications(rows) {
  return (rows || []).map(rowToMisidentification);
}

export async function listMisidentifications(worldId, { actId, isActive, limit = 500, offset = 0 } = {}) {
  const conditions = ["world_id = $1"];
  const params = [worldId];
  let idx = 2;

  if (actId) {
    conditions.push(`act_id = $${idx++}`);
    params.push(actId);
  }
  if (isActive !== undefined && isActive !== null && isActive !== "") {
    conditions.push(`is_active = $${idx++}`);
    params.push(String(isActive) === "true");
  }

  const sql = `SELECT ${RETURN_COLS} FROM ${TABLE}
    WHERE ${conditions.join(" AND ")}
    ORDER BY act_id ASC, sort_order ASC, timestamp ASC
    LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return rowsToMisidentifications(result.rows);
}

export async function getMisidentification(worldId, id) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE} WHERE id = $1 AND world_id = $2`,
    [id, worldId]
  );
  return rowToMisidentification(result.rows[0]);
}

export async function createMisidentification(worldId, body) {
  const result = await query(
    `INSERT INTO ${TABLE} (${COLS.join(", ")})
     VALUES (${COLS.map((_, i) => `$${i + 1}`).join(", ")})
     RETURNING ${RETURN_COLS}`,
    [
      worldId,
      body.actId,
      body.timestamp,
      body.sortOrder,
      body.holderId,
      body.holderLabel,
      body.title,
      body.content,
      body.truth,
      body.refutedByClueId || null,
      body.refutedByItemId || null,
      body.refutedAt,
      body.duration,
      body.isActive ?? true
    ]
  );
  return rowToMisidentification(result.rows[0]);
}

export async function updateMisidentification(worldId, id, body) {
  const sets = [];
  const params = [id, worldId];
  let idx = 3;

  for (const [col, key] of FIELD_SETS) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push(body[key]);
    }
  }

  if (sets.length === 0) return getMisidentification(worldId, id);

  sets.push("updated_at = now()");

  const result = await query(
    `UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = $1 AND world_id = $2 RETURNING ${RETURN_COLS}`,
    params
  );
  return rowToMisidentification(result.rows[0]);
}

export async function deleteMisidentification(worldId, id) {
  const result = await query(
    `DELETE FROM ${TABLE} WHERE id = $1 AND world_id = $2 RETURNING id`,
    [id, worldId]
  );
  if (!result.rows.length) throwErr("NOT_FOUND", "Misidentification not found");
  return { deleted: true };
}