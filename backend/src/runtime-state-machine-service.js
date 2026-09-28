// Runtime State Machine + Host Exception Remediation — service layer (缺口 M)
// CRUD for runtime state machines with per-state host exception remediation.

import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

const TABLE = "world_runtime_state_machines";
const RETURN_COLS = [
  "id", "world_id", "title", "sequence",
  "start_state", "end_state", "summary", "states",
  "created_at", "updated_at"
].join(", ");

function rowToMachine(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    title: row.title,
    sequence: row.sequence,
    startState: row.start_state,
    endState: row.end_state,
    summary: row.summary,
    states: row.states || [],
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function rowsToMachines(rows) {
  return (rows || []).map(rowToMachine);
}

export async function listRuntimeStateMachines(worldId, { limit = 200, offset = 0 } = {}) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE}
     WHERE world_id = $1
     ORDER BY sequence ASC, updated_at ASC
     LIMIT $2 OFFSET $3`,
    [worldId, limit, offset]
  );
  return rowsToMachines(result.rows);
}

export async function getRuntimeStateMachine(worldId, id) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM ${TABLE} WHERE id = $1 AND world_id = $2`,
    [id, worldId]
  );
  return rowToMachine(result.rows[0]);
}

export async function createRuntimeStateMachine(worldId, body) {
  const result = await query(
    `INSERT INTO ${TABLE}
       (world_id, title, sequence, start_state, end_state, summary, states)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING ${RETURN_COLS}`,
    [
      worldId,
      body.title || "",
      Number(body.sequence) || 1,
      body.startState || "",
      body.endState || "",
      body.summary || "",
      JSON.stringify(body.states || [])
    ]
  );
  return rowToMachine(result.rows[0]);
}

export async function updateRuntimeStateMachine(worldId, id, body) {
  const sets = [];
  const params = [id, worldId];
  let idx = 3;

  const fields = [
    ["title", "title", false],
    ["sequence", "sequence", true],
    ["start_state", "startState", false],
    ["end_state", "endState", false],
    ["summary", "summary", false]
  ];
  for (const [col, key, isNumber] of fields) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push(isNumber ? Number(body[key]) : body[key]);
    }
  }
  if (body.states !== undefined) {
    sets.push(`states = $${idx++}::jsonb`);
    params.push(JSON.stringify(body.states));
  }

  if (sets.length === 0) return getRuntimeStateMachine(worldId, id);

  sets.push("updated_at = now()");

  const result = await query(
    `UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = $1 AND world_id = $2 RETURNING ${RETURN_COLS}`,
    params
  );
  return rowToMachine(result.rows[0]);
}

export async function deleteRuntimeStateMachine(worldId, id) {
  const result = await query(
    `DELETE FROM ${TABLE} WHERE id = $1 AND world_id = $2 RETURNING id`,
    [id, worldId]
  );
  if (!result.rows.length) throwErr("NOT_FOUND", "Runtime state machine not found");
  return { deleted: true };
}