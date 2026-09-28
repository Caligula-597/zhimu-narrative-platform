// Ending Branch Editor — service layer
// CRUD for ending branch definitions (trigger, result and reveals).

import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

const TABLE = "world_endings";
const RETURN_COLS = [
  "id", "world_id", "title", "trigger", "result", "reveal_text",
  "reveal_clue_ids", "reveal_item_ids", "is_good", "sort_order",
  "created_at", "updated_at"
].join(", ");

function rowToEnding(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    title: row.title,
    trigger: row.trigger,
    result: row.result,
    revealText: row.reveal_text,
    revealClueIds: row.reveal_clue_ids || [],
    revealItemIds: row.reveal_item_ids || [],
    isGood: row.is_good,
    sortOrder: row.sort_order,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function rowsToEndings(rows) {
  return (rows || []).map(rowToEnding);
}

export async function listEndings(worldId, { limit = 200, offset = 0 } = {}) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE}
     WHERE world_id = $1
     ORDER BY sort_order ASC, created_at ASC
     LIMIT $2 OFFSET $3`,
    [worldId, limit, offset]
  );
  return rowsToEndings(result.rows);
}

export async function getEnding(worldId, id) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE} WHERE id = $1 AND world_id = $2`,
    [id, worldId]
  );
  return rowToEnding(result.rows[0]);
}

export async function createEnding(worldId, body) {
  const result = await query(
    `INSERT INTO ${TABLE}
       (world_id, title, trigger, result, reveal_text, reveal_clue_ids, reveal_item_ids, is_good, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
     RETURNING ${RETURN_COLS}`,
    [
      worldId,
      body.title,
      body.trigger,
      body.result,
      body.revealText,
      JSON.stringify(body.revealClueIds || []),
      JSON.stringify(body.revealItemIds || []),
      body.isGood ?? true,
      body.sortOrder ?? 0
    ]
  );
  return rowToEnding(result.rows[0]);
}

export async function updateEnding(worldId, id, body) {
  const sets = [];
  const params = [id, worldId];
  let idx = 3;

  const plainFields = [
    ["title", "title"],
    ["trigger", "trigger"],
    ["result", "result"],
    ["reveal_text", "revealText"],
    ["is_good", "isGood"],
    ["sort_order", "sortOrder"]
  ];
  for (const [col, key] of plainFields) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push(body[key]);
    }
  }
  if (body.revealClueIds !== undefined) {
    sets.push(`reveal_clue_ids = $${idx++}::jsonb`);
    params.push(JSON.stringify(body.revealClueIds));
  }
  if (body.revealItemIds !== undefined) {
    sets.push(`reveal_item_ids = $${idx++}::jsonb`);
    params.push(JSON.stringify(body.revealItemIds));
  }

  if (sets.length === 0) return getEnding(worldId, id);

  sets.push("updated_at = now()");

  const result = await query(
    `UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = $1 AND world_id = $2 RETURNING ${RETURN_COLS}`,
    params
  );
  return rowToEnding(result.rows[0]);
}

export async function deleteEnding(worldId, id) {
  const result = await query(
    `DELETE FROM ${TABLE} WHERE id = $1 AND world_id = $2 RETURNING id`,
    [id, worldId]
  );
  if (!result.rows.length) throwErr("NOT_FOUND", "Ending not found");
  return { deleted: true };
}