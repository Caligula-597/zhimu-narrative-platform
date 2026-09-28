// Location / Scene-State Enhancement — service layer
// CRUD for 地点/开放地图/现场状态登记（衙门令搜证、现场改写、监狱即时杀人点）.

import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

const TABLE = "world_loc_locations";
const RETURN_COLS = [
  "id", "world_id", "title", "sequence", "kind",
  "searchable", "rewritable", "state", "combat",
  "items_note", "note",
  "created_at", "updated_at"
].join(", ");

function rowToLoc(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    title: row.title,
    sequence: row.sequence || 0,
    kind: row.kind,
    searchable: row.searchable ?? true,
    rewritable: row.rewritable ?? false,
    state: row.state || {},
    combat: row.combat ?? false,
    itemsNote: row.items_note,
    note: row.note,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function rowsToLocs(rows) {
  return (rows || []).map(rowToLoc);
}

export async function listLocLocations(worldId, { limit = 300, offset = 0 } = {}) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE}
     WHERE world_id = $1
     ORDER BY kind, sequence, updated_at DESC
     LIMIT $2 OFFSET $3`,
    [worldId, limit, offset]
  );
  return rowsToLocs(result.rows);
}

export async function getLocLocation(worldId, id) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE} WHERE id = $1 AND world_id = $2`,
    [id, worldId]
  );
  return rowToLoc(result.rows[0]);
}

export async function createLocLocation(worldId, body) {
  const result = await query(
    `INSERT INTO ${TABLE}
       (world_id, title, sequence, kind, searchable, rewritable, state, combat, items_note, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
     RETURNING ${RETURN_COLS}`,
    [
      worldId,
      body.title || "",
      body.sequence || 0,
      body.kind || "现场",
      body.searchable ?? true,
      body.rewritable ?? false,
      JSON.stringify(body.state || {}),
      body.combat ?? false,
      body.itemsNote || "",
      body.note || ""
    ]
  );
  return rowToLoc(result.rows[0]);
}

export async function updateLocLocation(worldId, id, body) {
  const sets = [];
  const params = [id, worldId];
  let idx = 3;

  const fields = [
    ["title", "title"],
    ["sequence", "sequence"],
    ["kind", "kind"],
    ["searchable", "searchable"],
    ["rewritable", "rewritable"],
    ["combat", "combat"],
    ["items_note", "itemsNote"],
    ["note", "note"]
  ];
  for (const [col, key] of fields) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push(body[key]);
    }
  }
  if (body.state !== undefined) {
    sets.push(`state = $${idx++}::jsonb`);
    params.push(JSON.stringify(body.state || {}));
  }

  if (sets.length === 0) return getLocLocation(worldId, id);

  sets.push("updated_at = now()");

  const result = await query(
    `UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = $1 AND world_id = $2 RETURNING ${RETURN_COLS}`,
    params
  );
  return rowToLoc(result.rows[0]);
}

export async function deleteLocLocation(worldId, id) {
  const result = await query(
    `DELETE FROM ${TABLE} WHERE id = $1 AND world_id = $2 RETURNING id`,
    [id, worldId]
  );
  if (!result.rows.length) throwErr("NOT_FOUND", "Location not found");
  return { deleted: true };
}