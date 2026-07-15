/**
 * B6: Segment-level host remedy templates.
 */
import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

function sanitizeText(value = "", max = 4000) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

export async function listSegmentRemedies(worldId, segmentKey = null) {
  const params = [worldId];
  let segmentFilter = "";
  if (segmentKey) {
    params.push(segmentKey);
    segmentFilter = ` AND segment_key = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT id, segment_key, title, host_script, trigger_hint, sequence, created_at, updated_at
     FROM segment_remedies
     WHERE world_id = $1${segmentFilter}
     ORDER BY segment_key, sequence, created_at`,
    params
  );
  return rows;
}

export async function createSegmentRemedy(worldId, body, runQuery = query) {
  const title = sanitizeText(body?.title, 200);
  const hostScript = sanitizeText(body?.hostScript ?? body?.host_script, 4000);
  const segmentKey = sanitizeText(body?.segmentKey ?? body?.segment_key, 40);
  if (!title || !hostScript || !segmentKey) throwErr("BAD_REQUEST", "segmentKey, title and hostScript are required");
  const { rows } = await runQuery(
    `INSERT INTO segment_remedies (world_id, segment_key, title, host_script, trigger_hint, sequence)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      worldId,
      segmentKey,
      title,
      hostScript,
      sanitizeText(body?.triggerHint ?? body?.trigger_hint, 500) || null,
      Number(body?.sequence) || 1
    ]
  );
  return rows[0];
}

export async function updateSegmentRemedy(remedyId, worldId, body, runQuery = query) {
  const title = body?.title != null ? sanitizeText(body.title, 200) : null;
  const hostScript = body?.hostScript != null || body?.host_script != null
    ? sanitizeText(body.hostScript ?? body.host_script, 4000)
    : null;
  const { rows } = await runQuery(
    `UPDATE segment_remedies
     SET title = COALESCE($3, title),
         host_script = COALESCE($4, host_script),
         trigger_hint = COALESCE($5, trigger_hint),
         sequence = COALESCE($6, sequence),
         updated_at = now()
     WHERE id = $1 AND world_id = $2
     RETURNING *`,
    [
      remedyId,
      worldId,
      title,
      hostScript,
      body?.triggerHint != null || body?.trigger_hint != null
        ? sanitizeText(body.triggerHint ?? body.trigger_hint, 500) || null
        : null,
      body?.sequence != null ? Number(body.sequence) : null
    ]
  );
  if (!rows.length) throwErr("NOT_FOUND");
  return rows[0];
}

export async function deleteSegmentRemedy(remedyId, worldId, runQuery = query) {
  const { rowCount } = await runQuery(`DELETE FROM segment_remedies WHERE id = $1 AND world_id = $2`, [remedyId, worldId]);
  if (!rowCount) throwErr("NOT_FOUND");
  return { ok: true };
}

export async function applySegmentRemedy(runQuery, { roomId, remedyId, hostUserId }) {
  const remedy = await runQuery(
    `SELECT sr.id, sr.world_id, sr.segment_key, sr.title, sr.host_script, sr.trigger_hint
     FROM segment_remedies sr
     JOIN rooms r ON r.world_id = sr.world_id AND r.id = $1
     WHERE sr.id = $2`,
    [roomId, remedyId]
  );
  if (!remedy.rowCount) throwErr("NOT_FOUND");
  const row = remedy.rows[0];
  await runQuery(
    `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
     VALUES ($1, $2, 'host', 'segment_remedy_applied', $3, jsonb_build_object('remedyId', $4::text, 'segmentKey', $5::text))`,
    [roomId, hostUserId, `主持补救：${row.title}`, row.id, row.segment_key]
  );
  return row;
}
