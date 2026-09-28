// Relationship Arc Editor — service layer
// CRUD for multi-stage relationship progressions between two characters.

import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

const TABLE = "world_relationship_arcs";
const RETURN_COLS = [
  "id", "world_id", "title",
  "char_a_id", "char_a_label", "char_b_id", "char_b_label",
  "summary", "stages", "created_at", "updated_at"
].join(", ");

function rowToArc(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    title: row.title,
    charAId: row.char_a_id,
    charALabel: row.char_a_label,
    charBId: row.char_b_id,
    charBLabel: row.char_b_label,
    summary: row.summary,
    stages: row.stages || [],
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function rowsToArcs(rows) {
  return (rows || []).map(rowToArc);
}

export async function listRelationshipArcs(worldId, { limit = 200, offset = 0 } = {}) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE}
     WHERE world_id = $1
     ORDER BY updated_at DESC
     LIMIT $2 OFFSET $3`,
    [worldId, limit, offset]
  );
  return rowsToArcs(result.rows);
}

export async function getRelationshipArc(worldId, id) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE} WHERE id = $1 AND world_id = $2`,
    [id, worldId]
  );
  return rowToArc(result.rows[0]);
}

export async function createRelationshipArc(worldId, body) {
  const result = await query(
    `INSERT INTO ${TABLE}
       (world_id, title, char_a_id, char_a_label, char_b_id, char_b_label, summary, stages)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING ${RETURN_COLS}`,
    [
      worldId,
      body.title,
      body.charAId || null,
      body.charALabel,
      body.charBId || null,
      body.charBLabel,
      body.summary,
      JSON.stringify(body.stages || [])
    ]
  );
  return rowToArc(result.rows[0]);
}

export async function updateRelationshipArc(worldId, id, body) {
  const sets = [];
  const params = [id, worldId];
  let idx = 3;

  const fields = [
    ["title", "title"],
    ["char_a_id", "charAId"],
    ["char_a_label", "charALabel"],
    ["char_b_id", "charBId"],
    ["char_b_label", "charBLabel"],
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

  if (sets.length === 0) return getRelationshipArc(worldId, id);

  sets.push("updated_at = now()");

  const result = await query(
    `UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = $1 AND world_id = $2 RETURNING ${RETURN_COLS}`,
    params
  );
  return rowToArc(result.rows[0]);
}

export async function deleteRelationshipArc(worldId, id) {
  const result = await query(
    `DELETE FROM ${TABLE} WHERE id = $1 AND world_id = $2 RETURNING id`,
    [id, worldId]
  );
  if (!result.rows.length) throwErr("NOT_FOUND", "Relationship arc not found");
  return { deleted: true };
}