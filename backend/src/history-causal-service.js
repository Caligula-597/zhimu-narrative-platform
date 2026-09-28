// Historical Causality Table — service layer (缺口 H)
// CRUD for historical events arranged as a causal chain (cause → event → effect).

import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

const TABLE = "world_history_causal_links";
const RETURN_COLS = [
  "id", "world_id", "title", "sequence", "when_text",
  "actors", "cause_text", "event_text", "effect_text", "summary",
  "created_at", "updated_at"
].join(", ");

function rowToLink(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    title: row.title,
    sequence: row.sequence,
    whenText: row.when_text,
    actors: row.actors,
    causeText: row.cause_text,
    eventText: row.event_text,
    effectText: row.effect_text,
    summary: row.summary,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function rowsToLinks(rows) {
  return (rows || []).map(rowToLink);
}

export async function listHistoryCausalLinks(worldId, { limit = 500, offset = 0 } = {}) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE}
     WHERE world_id = $1
     ORDER BY sequence ASC, updated_at ASC
     LIMIT $2 OFFSET $3`,
    [worldId, limit, offset]
  );
  return rowsToLinks(result.rows);
}

export async function getHistoryCausalLink(worldId, id) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE} WHERE id = $1 AND world_id = $2`,
    [id, worldId]
  );
  return rowToLink(result.rows[0]);
}

export async function createHistoryCausalLink(worldId, body) {
  const result = await query(
    `INSERT INTO ${TABLE}
       (world_id, title, sequence, when_text, actors, cause_text, event_text, effect_text, summary)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${RETURN_COLS}`,
    [
      worldId,
      body.title || "",
      Number(body.sequence) || 1,
      body.whenText || "",
      body.actors || "",
      body.causeText || "",
      body.eventText || "",
      body.effectText || "",
      body.summary || ""
    ]
  );
  return rowToLink(result.rows[0]);
}

export async function updateHistoryCausalLink(worldId, id, body) {
  const sets = [];
  const params = [id, worldId];
  let idx = 3;

  const fields = [
    ["title", "title", false],
    ["sequence", "sequence", true],
    ["when_text", "whenText", false],
    ["actors", "actors", false],
    ["cause_text", "causeText", false],
    ["event_text", "eventText", false],
    ["effect_text", "effectText", false],
    ["summary", "summary", false]
  ];
  for (const [col, key, isNumber] of fields) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push(isNumber ? Number(body[key]) : body[key]);
    }
  }

  if (sets.length === 0) return getHistoryCausalLink(worldId, id);

  sets.push("updated_at = now()");

  const result = await query(
    `UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = $1 AND world_id = $2 RETURNING ${RETURN_COLS}`,
    params
  );
  return rowToLink(result.rows[0]);
}

export async function deleteHistoryCausalLink(worldId, id) {
  const result = await query(
    `DELETE FROM ${TABLE} WHERE id = $1 AND world_id = $2 RETURNING id`,
    [id, worldId]
  );
  if (!result.rows.length) throwErr("NOT_FOUND", "History causal link not found");
  return { deleted: true };
}