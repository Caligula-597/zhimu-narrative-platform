// NPC Script Editor — service layer
// CRUD for NPC 专属内容（独立剧本 + 身份人生 + 显著数值 JSONB）.

import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

const TABLE = "world_npcs";
const RETURN_COLS = [
  "id", "world_id", "title", "sequence",
  "salient_nums", "summary", "bio", "private_script",
  "created_at", "updated_at"
].join(", ");

function rowToNpc(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    title: row.title,
    sequence: row.sequence || 0,
    salientNums: row.salient_nums || {},
    summary: row.summary,
    bio: row.bio,
    privateScript: row.private_script,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function rowsToNpcs(rows) {
  return (rows || []).map(rowToNpc);
}

export async function listNpcs(worldId, { limit = 200, offset = 0 } = {}) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE}
     WHERE world_id = $1
     ORDER BY sequence, updated_at DESC
     LIMIT $2 OFFSET $3`,
    [worldId, limit, offset]
  );
  return rowsToNpcs(result.rows);
}

export async function getNpc(worldId, id) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE} WHERE id = $1 AND world_id = $2`,
    [id, worldId]
  );
  return rowToNpc(result.rows[0]);
}

export async function createNpc(worldId, body) {
  const result = await query(
    `INSERT INTO ${TABLE}
       (world_id, title, sequence, salient_nums, summary, bio, private_script)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
     RETURNING ${RETURN_COLS}`,
    [
      worldId,
      body.title || "",
      body.sequence || 0,
      JSON.stringify(body.salientNums || {}),
      body.summary || "",
      body.bio || "",
      body.privateScript || ""
    ]
  );
  return rowToNpc(result.rows[0]);
}

export async function updateNpc(worldId, id, body) {
  const sets = [];
  const params = [id, worldId];
  let idx = 3;

  const fields = [
    ["title", "title"],
    ["sequence", "sequence"],
    ["summary", "summary"],
    ["bio", "bio"],
    ["private_script", "privateScript"]
  ];
  for (const [col, key] of fields) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push(body[key]);
    }
  }
  if (body.salientNums !== undefined) {
    sets.push(`salient_nums = $${idx++}::jsonb`);
    params.push(JSON.stringify(body.salientNums || {}));
  }

  if (sets.length === 0) return getNpc(worldId, id);

  sets.push("updated_at = now()");

  const result = await query(
    `UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = $1 AND world_id = $2 RETURNING ${RETURN_COLS}`,
    params
  );
  return rowToNpc(result.rows[0]);
}

export async function deleteNpc(worldId, id) {
  const result = await query(
    `DELETE FROM ${TABLE} WHERE id = $1 AND world_id = $2 RETURNING id`,
    [id, worldId]
  );
  if (!result.rows.length) throwErr("NOT_FOUND", "NPC not found");
  return { deleted: true };
}