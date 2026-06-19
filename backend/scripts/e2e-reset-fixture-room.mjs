/**
 * Remove ephemeral play-test room members so invite-code E2E can pick roles.
 * Keeps host + seed fixture player (Role A) from db:seed.
 */
import { pool } from "../src/db.js";
import { FIXTURE } from "./fixture-constants.mjs";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(
    `DELETE FROM room_members
     WHERE room_id = $1
       AND member_type = 'player'
       AND user_id <> $2`,
    [FIXTURE.roomId, FIXTURE.playerUserId]
  );
  await client.query(`DELETE FROM reading_progress WHERE room_id = $1`, [FIXTURE.roomId]);
  await client.query(
    `UPDATE room_members
     SET status = 'active', joined_at = COALESCE(joined_at, now())
     WHERE room_id = $1 AND user_id = $2 AND member_type = 'player'`,
    [FIXTURE.roomId, FIXTURE.playerUserId]
  );
  await client.query("COMMIT");
  console.log(JSON.stringify({ ok: true, roomId: FIXTURE.roomId }, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
