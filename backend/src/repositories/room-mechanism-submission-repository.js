import { query } from "../db.js";

function run(client, text, params = []) {
  return client?.query ? client.query(text, params) : query(text, params);
}

function project(row) {
  if (!row) return null;
  return {
    roomId: row.room_id,
    runtimeInitializedAt: row.runtime_initialized_at,
    mechanismRevision: Number(row.mechanism_revision),
    roundKey: row.round_key,
    decisionKey: row.decision_key,
    roleSlotId: row.role_slot_id,
    roleName: row.role_name ?? "",
    actorUserId: row.actor_user_id,
    optionKey: row.option_key,
    answer:
      row.answer && typeof row.answer === "object" && !Array.isArray(row.answer)
        ? row.answer
        : {},
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertRoomMechanismSubmission(
  client,
  {
    roomId,
    runtimeInitializedAt,
    mechanismRevision,
    roundKey,
    decisionKey,
    roleSlotId,
    actorId,
    optionKey,
    answer,
  },
) {
  const result = await client.query(
    `INSERT INTO room_mechanism_decision_submissions (
       room_id, runtime_initialized_at, mechanism_revision, round_key,
       decision_key, role_slot_id, actor_user_id, option_key, answer
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (room_id, runtime_initialized_at, decision_key, role_slot_id)
     DO UPDATE SET
       mechanism_revision = EXCLUDED.mechanism_revision,
       round_key = EXCLUDED.round_key,
       actor_user_id = EXCLUDED.actor_user_id,
       option_key = EXCLUDED.option_key,
       answer = EXCLUDED.answer,
       updated_at = now()
     RETURNING *`,
    [
      roomId,
      runtimeInitializedAt,
      mechanismRevision,
      roundKey,
      decisionKey,
      roleSlotId,
      actorId,
      optionKey,
      answer,
    ],
  );
  return project(result.rows[0]);
}

export async function listRoomMechanismSubmissions(
  roomId,
  runtimeInitializedAt,
  { client = null } = {},
) {
  const result = await run(
    client,
    `SELECT submission.*, role.name AS role_name
     FROM room_mechanism_decision_submissions submission
     LEFT JOIN role_slots role ON role.id = submission.role_slot_id
     WHERE submission.room_id = $1
       AND submission.runtime_initialized_at = $2
     ORDER BY submission.decision_key, role.sequence NULLS LAST, submission.updated_at`,
    [roomId, runtimeInitializedAt],
  );
  return result.rows.map(project);
}
