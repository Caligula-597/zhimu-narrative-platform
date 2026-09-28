// Object Lifecycle Editor — service layer
// CRUD for per-item lifecycle state machines (建立→变化→运行→回收).

import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

const TABLE = "world_object_lifecycles";
const RETURN_COLS = [
  "id", "world_id", "title",
  "item_id", "item_label", "summary", "stages",
  "created_at", "updated_at"
].join(", ");

function rowToLifecycle(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    title: row.title,
    itemId: row.item_id || "",
    itemLabel: row.item_label,
    summary: row.summary,
    stages: row.stages || [],
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function rowsToLifecycles(rows) {
  return (rows || []).map(rowToLifecycle);
}

export async function listObjectLifecycles(worldId, { limit = 200, offset = 0 } = {}) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE}
     WHERE world_id = $1
     ORDER BY updated_at DESC
     LIMIT $2 OFFSET $3`,
    [worldId, limit, offset]
  );
  return rowsToLifecycles(result.rows);
}

export async function getObjectLifecycle(worldId, id) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE} WHERE id = $1 AND world_id = $2`,
    [id, worldId]
  );
  return rowToLifecycle(result.rows[0]);
}

export async function createObjectLifecycle(worldId, body) {
  const result = await query(
    `INSERT INTO ${TABLE}
       (world_id, title, item_id, item_label, summary, stages)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING ${RETURN_COLS}`,
    [
      worldId,
      body.title || "",
      body.itemId || null,
      body.itemLabel || "",
      body.summary || "",
      JSON.stringify(body.stages || [])
    ]
  );
  return rowToLifecycle(result.rows[0]);
}

export async function updateObjectLifecycle(worldId, id, body) {
  const sets = [];
  const params = [id, worldId];
  let idx = 3;

  const fields = [
    ["title", "title"],
    ["item_id", "itemId"],
    ["item_label", "itemLabel"],
    ["summary", "summary"]
  ];
  for (const [col, key] of fields) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push(body[key] === "" ? null : body[key]);
    }
  }
  if (body.stages !== undefined) {
    sets.push(`stages = $${idx++}::jsonb`);
    params.push(JSON.stringify(body.stages));
  }

  if (sets.length === 0) return getObjectLifecycle(worldId, id);

  sets.push("updated_at = now()");

  const result = await query(
    `UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = $1 AND world_id = $2 RETURNING ${RETURN_COLS}`,
    params
  );
  return rowToLifecycle(result.rows[0]);
}

export async function deleteObjectLifecycle(worldId, id) {
  const result = await query(
    `DELETE FROM ${TABLE} WHERE id = $1 AND world_id = $2 RETURNING id`,
    [id, worldId]
  );
  if (!result.rows.length) throwErr("NOT_FOUND", "Object lifecycle not found");
  return { deleted: true };
}