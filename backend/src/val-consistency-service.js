// Val Consistency Ledger — service layer
// CRUD for version-contradiction records (一致性台账).

import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

const TABLE = "world_val_records";
const RETURN_COLS = [
  "id", "world_id", "title", "sequence",
  "references_entry", "conflict_desc", "version_a", "version_b",
  "recommendation", "status",
  "created_at", "updated_at"
].join(", ");

function rowToVal(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    title: row.title,
    sequence: row.sequence || 0,
    referencesEntry: row.references_entry,
    conflictDesc: row.conflict_desc,
    versionA: row.version_a,
    versionB: row.version_b,
    recommendation: row.recommendation,
    status: row.status,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function rowsToVals(rows) {
  return (rows || []).map(rowToVal);
}

export async function listValRecords(worldId, { limit = 200, offset = 0 } = {}) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE}
     WHERE world_id = $1
     ORDER BY updated_at DESC
     LIMIT $2 OFFSET $3`,
    [worldId, limit, offset]
  );
  return rowsToVals(result.rows);
}

export async function getValRecord(worldId, id) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE} WHERE id = $1 AND world_id = $2`,
    [id, worldId]
  );
  return rowToVal(result.rows[0]);
}

export async function createValRecord(worldId, body) {
  const result = await query(
    `INSERT INTO ${TABLE}
       (world_id, title, sequence, references_entry, conflict_desc,
        version_a, version_b, recommendation, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${RETURN_COLS}`,
    [
      worldId,
      body.title || "",
      body.sequence || 0,
      body.referencesEntry || "",
      body.conflictDesc || "",
      body.versionA || "",
      body.versionB || "",
      body.recommendation || "",
      body.status || "未决"
    ]
  );
  return rowToVal(result.rows[0]);
}

export async function updateValRecord(worldId, id, body) {
  const sets = [];
  const params = [id, worldId];
  let idx = 3;

  const fields = [
    ["title", "title"],
    ["sequence", "sequence"],
    ["references_entry", "referencesEntry"],
    ["conflict_desc", "conflictDesc"],
    ["version_a", "versionA"],
    ["version_b", "versionB"],
    ["recommendation", "recommendation"]
  ];
  for (const [col, key] of fields) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push(body[key]);
    }
  }
  if (body.status !== undefined) {
    sets.push(`status = $${idx++}`);
    params.push(body.status);
  }

  if (sets.length === 0) return getValRecord(worldId, id);

  sets.push("updated_at = now()");

  const result = await query(
    `UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = $1 AND world_id = $2 RETURNING ${RETURN_COLS}`,
    params
  );
  return rowToVal(result.rows[0]);
}

export async function deleteValRecord(worldId, id) {
  const result = await query(
    `DELETE FROM ${TABLE} WHERE id = $1 AND world_id = $2 RETURNING id`,
    [id, worldId]
  );
  if (!result.rows.length) throwErr("NOT_FOUND", "Val record not found");
  return { deleted: true };
}