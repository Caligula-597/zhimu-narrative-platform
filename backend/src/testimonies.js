/**
 * B3: Player testimony submissions + host review flags.
 */
import { throwErr } from "./api-errors.js";

function sanitizeText(value = "", max = 4000) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

const VALID_FLAGS = new Set(["noted", "contradiction"]);

export async function submitTestimony(runQuery, { roomId, roleSlotId, actKey, body }) {
  const content = sanitizeText(body);
  if (!content) throwErr("BAD_REQUEST", "Testimony body is required");
  const { rows } = await runQuery(
    `INSERT INTO testimonies (room_id, role_slot_id, act_key, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, room_id, role_slot_id, act_key, body, host_flag, submitted_at`,
    [roomId, roleSlotId, actKey ? sanitizeText(actKey, 40) : null, content]
  );
  return rows[0];
}

export async function fetchMyTestimonies(runQuery, roomId, roleSlotId) {
  const { rows } = await runQuery(
    `SELECT id, act_key, body, host_flag, host_note, submitted_at, reviewed_at
     FROM testimonies
     WHERE room_id = $1 AND role_slot_id = $2
     ORDER BY submitted_at DESC`,
    [roomId, roleSlotId]
  );
  return rows;
}

export async function listRoomTestimoniesForHost(runQuery, roomId) {
  const { rows } = await runQuery(
    `SELECT t.id, t.role_slot_id, rs.name AS role_name, t.act_key, t.body,
            t.host_flag, t.host_note, t.submitted_at, t.reviewed_at
     FROM testimonies t
     JOIN role_slots rs ON rs.id = t.role_slot_id
     WHERE t.room_id = $1
     ORDER BY t.submitted_at DESC`,
    [roomId]
  );
  return rows;
}

export async function reviewTestimony(runQuery, { testimonyId, roomId, reviewerId, hostFlag, hostNote }) {
  if (hostFlag != null && !VALID_FLAGS.has(hostFlag)) throwErr("BAD_REQUEST", "Invalid host flag");
  const { rows } = await runQuery(
    `UPDATE testimonies
     SET host_flag = $3, host_note = $4, reviewed_at = now(), reviewed_by = $5
     WHERE id = $1 AND room_id = $2
     RETURNING id, role_slot_id, host_flag, host_note, reviewed_at`,
    [testimonyId, roomId, hostFlag || null, sanitizeText(hostNote, 1000) || null, reviewerId]
  );
  if (!rows.length) throwErr("NOT_FOUND");
  return rows[0];
}
