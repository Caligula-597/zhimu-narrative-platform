// Economic System Editor — service layer
// CRUD for world economic records (银两初始/拍卖/宝箱/经济规则).

import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

const TABLE = "world_econ_records";
const RETURN_COLS = [
  "id", "world_id", "title", "category", "sequence",
  "actor_label", "amount", "source", "note", "summary",
  "created_at", "updated_at"
].join(", ");

function rowToEcon(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    title: row.title,
    category: row.category,
    sequence: row.sequence || 0,
    actorLabel: row.actor_label,
    amount: row.amount == null ? 0 : Number(row.amount),
    source: row.source,
    note: row.note,
    summary: row.summary,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function rowsToEcon(rows) {
  return (rows || []).map(rowToEcon);
}

export async function listEconRecords(worldId, { limit = 300, offset = 0 } = {}) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE}
     WHERE world_id = $1
     ORDER BY category, sequence, updated_at DESC
     LIMIT $2 OFFSET $3`,
    [worldId, limit, offset]
  );
  return rowsToEcon(result.rows);
}

export async function getEconRecord(worldId, id) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE} WHERE id = $1 AND world_id = $2`,
    [id, worldId]
  );
  return rowToEcon(result.rows[0]);
}

export async function createEconRecord(worldId, body) {
  const result = await query(
    `INSERT INTO ${TABLE}
       (world_id, title, category, sequence, actor_label, amount, source, note, summary)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${RETURN_COLS}`,
    [
      worldId,
      body.title || "",
      body.category || "initial",
      body.sequence || 0,
      body.actorLabel || "",
      (body.amount == null ? 0 : body.amount),
      body.source || "",
      body.note || "",
      body.summary || ""
    ]
  );
  return rowToEcon(result.rows[0]);
}

export async function updateEconRecord(worldId, id, body) {
  const sets = [];
  const params = [id, worldId];
  let idx = 3;

  const fields = [
    ["title", "title"],
    ["category", "category"],
    ["sequence", "sequence"],
    ["actor_label", "actorLabel"],
    ["amount", "amount"],
    ["source", "source"],
    ["note", "note"],
    ["summary", "summary"]
  ];
  for (const [col, key] of fields) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push(key === "amount" ? (body[key] == null ? 0 : body[key]) : body[key]);
    }
  }

  if (sets.length === 0) return getEconRecord(worldId, id);

  sets.push("updated_at = now()");

  const result = await query(
    `UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = $1 AND world_id = $2 RETURNING ${RETURN_COLS}`,
    params
  );
  return rowToEcon(result.rows[0]);
}

export async function deleteEconRecord(worldId, id) {
  const result = await query(
    `DELETE FROM ${TABLE} WHERE id = $1 AND world_id = $2 RETURNING id`,
    [id, worldId]
  );
  if (!result.rows.length) throwErr("NOT_FOUND", "Economic record not found");
  return { deleted: true };
}