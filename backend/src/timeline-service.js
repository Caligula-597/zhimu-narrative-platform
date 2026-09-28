// Timeline Editor — service layer
// CRUD for multi-line parallel action timeline entries

import { query, transaction } from "./db.js";
import { throwErr } from "./api-errors.js";

const TABLE = "world_timeline_entries";
const RETURN_COLS = [
  "id", "world_id", "act_id", "timestamp", "sort_order",
  "parallel_line", "actor_id", "action", "impact", "cognitions",
  "created_at", "updated_at"
].join(", ");

function rowToEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    actId: row.act_id,
    timestamp: row.timestamp,
    sortOrder: row.sort_order,
    parallelLine: row.parallel_line,
    actorId: row.actor_id,
    action: row.action,
    impact: row.impact,
    cognitions: row.cognitions || [],
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function rowsToEntries(rows) {
  return (rows || []).map(rowToEntry);
}

export async function listTimelineEntries(worldId, { actId, parallelLine, limit = 200, offset = 0 } = {}) {
  const conditions = ["world_id = $1"];
  const params = [worldId];
  let idx = 2;

  if (actId) {
    conditions.push(`act_id = $${idx++}`);
    params.push(actId);
  }
  if (parallelLine !== undefined && parallelLine !== null) {
    conditions.push(`parallel_line = $${idx++}`);
    params.push(parallelLine);
  }

  const sql = `SELECT ${RETURN_COLS} FROM ${TABLE}
    WHERE ${conditions.join(" AND ")}
    ORDER BY sort_order ASC, parallel_line ASC
    LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return rowsToEntries(result.rows);
}

export async function getTimelineEntry(worldId, entryId) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE} WHERE id = $1 AND world_id = $2`,
    [entryId, worldId]
  );
  return rowToEntry(result.rows[0]);
}

export async function createTimelineEntry(worldId, body) {
  const result = await query(
    `INSERT INTO ${TABLE} (world_id, act_id, timestamp, sort_order, parallel_line, actor_id, action, impact, cognitions)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING ${RETURN_COLS}`,
    [
      worldId,
      body.actId,
      body.timestamp,
      body.sortOrder,
      body.parallelLine,
      body.actorId,
      body.action,
      body.impact,
      JSON.stringify(body.cognitions || [])
    ]
  );
  return rowToEntry(result.rows[0]);
}

export async function updateTimelineEntry(worldId, entryId, body) {
  const sets = [];
  const params = [entryId, worldId];
  let idx = 3;

  const fields = [
    ["act_id", "actId"],
    ["timestamp", "timestamp"],
    ["sort_order", "sortOrder"],
    ["parallel_line", "parallelLine"],
    ["actor_id", "actorId"],
    ["action", "action"],
    ["impact", "impact"]
  ];

  for (const [col, key] of fields) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push(body[key]);
    }
  }

  if (body.cognitions !== undefined) {
    sets.push(`cognitions = $${idx++}::jsonb`);
    params.push(JSON.stringify(body.cognitions));
  }

  if (sets.length === 0) return null;

  sets.push("updated_at = now()");

  const result = await query(
    `UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = $1 AND world_id = $2 RETURNING ${RETURN_COLS}`,
    params
  );
  return rowToEntry(result.rows[0]);
}

export async function deleteTimelineEntry(worldId, entryId) {
  const result = await query(
    `DELETE FROM ${TABLE} WHERE id = $1 AND world_id = $2 RETURNING id`,
    [entryId, worldId]
  );
  if (!result.rows.length) throwErr("NOT_FOUND", "Timeline entry not found");
  return { deleted: true };
}

export async function batchUpdateTimeline(worldId, entries) {
  return transaction(async (client) => {
    const results = [];
    for (const entry of entries) {
      const sets = ["updated_at = now()"];
      const params = [entry.id, worldId];
      let idx = 3;

      const fields = [
        ["sort_order", "sortOrder"],
        ["parallel_line", "parallelLine"],
        ["timestamp", "timestamp"],
        ["action", "action"],
        ["impact", "impact"]
      ];

      for (const [col, key] of fields) {
        if (entry[key] !== undefined) {
          sets.push(`${col} = $${idx++}`);
          params.push(entry[key]);
        }
      }

      const result = await client.query(
        `UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = $1 AND world_id = $2 RETURNING ${RETURN_COLS}`,
        params
      );
      if (result.rows.length) results.push(rowToEntry(result.rows[0]));
    }
    return results;
  });
}