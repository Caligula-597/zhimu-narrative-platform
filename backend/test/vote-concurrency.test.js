import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { pool, query } from "../src/db.js";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import { queryFixtureRoleId } from "./helpers/fixture-helpers.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";

test("ballot waits for a concurrent close and cannot commit after the vote closes", async (context) => {
  const roleSlotId = await queryFixtureRoleId(playerUserId);
  const vote = await query(
    `INSERT INTO room_votes (room_id, created_by_user_id, title, prompt, vote_type, visibility)
     VALUES ($1, $2, 'concurrency vote', '', 'choice', 'public') RETURNING id`,
    [fixtureRoomId, hostUserId]
  );
  const voteId = vote.rows[0].id;
  const option = await query(
    `INSERT INTO room_vote_options (vote_id, label, sequence) VALUES ($1, 'one', 1) RETURNING id`,
    [voteId]
  );
  const optionId = option.rows[0].id;
  context.after(async () => {
    await query(`DELETE FROM room_vote_ballots WHERE vote_id = $1`, [voteId]);
    await query(`DELETE FROM room_vote_options WHERE vote_id = $1`, [voteId]);
    await query(`DELETE FROM room_votes WHERE id = $1`, [voteId]);
  });

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const locker = await pool.connect();
  let transactionOpen = false;
  try {
    await locker.query("BEGIN");
    transactionOpen = true;
    await locker.query(`UPDATE room_votes SET status = 'closed' WHERE id = $1`, [voteId]);

    const ballotPromise = app.inject({
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/votes/${voteId}/ballots`,
      headers: { "x-user-id": playerUserId },
      payload: { optionId }
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await locker.query("COMMIT");
    transactionOpen = false;

    const response = await ballotPromise;
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, "BAD_REQUEST");
    const ballots = await query(
      `SELECT 1 FROM room_vote_ballots WHERE vote_id = $1 AND role_slot_id = $2`,
      [voteId, roleSlotId]
    );
    assert.equal(ballots.rowCount, 0);
  } finally {
    if (transactionOpen) await locker.query("ROLLBACK").catch(() => {});
    locker.release();
  }
});
