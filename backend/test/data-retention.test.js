import assert from "node:assert/strict";
import test from "node:test";
import { query } from "../src/db.js";
import { purgeExpiredData, resolveRetentionDays } from "../src/data-retention.js";

test("resolveRetentionDays reads env overrides", () => {
  const days = resolveRetentionDays({ RETENTION_OAUTH_STATES_DAYS: "3" });
  assert.equal(days.oauthStates, 3);
  assert.equal(days.expiredSessions, 30);
  assert.equal(days.voiceMessages, 90);
  assert.equal(days.accountCreationEvents, 7);
  assert.equal(days.opsUserAudits, 180);
});

test("purgeExpiredData dry-run returns counts without deleting", async () => {
  const tokenHash = `retention-test-${Date.now()}`;
  const user = await query(
    `INSERT INTO users (email, display_name, password_hash, password_salt)
     VALUES ($1, 'Retention Test', 'x', 'y') RETURNING id`,
    [`retention-${Date.now()}@zhimu.local`]
  );
  const userId = user.rows[0].id;
  await query(
    `INSERT INTO oauth_states (state_hash, provider, expires_at)
     VALUES ($1, 'google', now() - interval '2 days')`,
    [tokenHash]
  );

  const before = await purgeExpiredData({ dryRun: true, days: { oauthStates: 1 } });
  assert.ok(before.deleted.oauthStates >= 1);

  const row = await query(`SELECT 1 FROM oauth_states WHERE state_hash = $1`, [tokenHash]);
  assert.equal(row.rowCount, 1);

  const after = await purgeExpiredData({ days: { oauthStates: 1 } });
  assert.ok(after.deleted.oauthStates >= 1);

  const gone = await query(`SELECT 1 FROM oauth_states WHERE state_hash = $1`, [tokenHash]);
  assert.equal(gone.rowCount, 0);

  await query(`DELETE FROM users WHERE id = $1`, [userId]);
});
