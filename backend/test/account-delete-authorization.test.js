import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_DELETE_RECENT_SESSION_MS,
  authorizeAccountDeletion,
  buildAccountDeleteReauthentication
} from "../src/account-delete-authorization.js";
import { hashPassword } from "../src/auth.js";

function executorFor(row) {
  return async () => ({ rows: row ? [row] : [], rowCount: row ? 1 : 0 });
}

test("account deletion requires the current password when credentials exist", async () => {
  const credentials = await hashPassword("correct-password-123");
  const row = {
    id: "user-1",
    password_hash: credentials.passwordHash,
    password_salt: credentials.passwordSalt,
    session_id: "session-1",
    session_created_at: new Date()
  };

  await assert.rejects(
    authorizeAccountDeletion({
      userId: row.id,
      sessionId: row.session_id,
      password: "wrong-password-123",
      executor: executorFor(row)
    }),
    (error) => error.code === "ACCOUNT_DELETE_REAUTHENTICATION_REQUIRED"
  );
  const proof = await authorizeAccountDeletion({
    userId: row.id,
    sessionId: row.session_id,
    password: "correct-password-123",
    executor: executorFor(row)
  });
  assert.equal(proof.mode, "password");
  assert.equal(proof.passwordHash, credentials.passwordHash);
});

test("passwordless account deletion requires a recent active session", async () => {
  const now = Date.now();
  const fresh = {
    id: "user-2",
    password_hash: null,
    password_salt: null,
    session_id: "session-2",
    session_created_at: new Date(now - 60_000)
  };
  const proof = await authorizeAccountDeletion({
    userId: fresh.id,
    sessionId: fresh.session_id,
    executor: executorFor(fresh),
    now
  });
  assert.deepEqual(
    { mode: proof.mode, sessionId: proof.sessionId },
    { mode: "recent_session", sessionId: fresh.session_id }
  );

  const stale = {
    ...fresh,
    session_created_at: new Date(now - ACCOUNT_DELETE_RECENT_SESSION_MS - 1)
  };
  await assert.rejects(
    authorizeAccountDeletion({
      userId: stale.id,
      sessionId: stale.session_id,
      executor: executorFor(stale),
      now
    }),
    (error) => error.code === "ACCOUNT_DELETE_REAUTHENTICATION_REQUIRED"
  );
});

test("account deletion preview exposes only the required reauthentication mode", async () => {
  const credentials = await hashPassword("preview-password-123");
  const state = await buildAccountDeleteReauthentication("user-3", "session-3", {
    executor: executorFor({
      id: "user-3",
      password_hash: credentials.passwordHash,
      password_salt: credentials.passwordSalt,
      session_id: "session-3",
      session_created_at: new Date()
    })
  });
  assert.deepEqual(state, {
    mode: "password",
    recentSessionEligible: false,
    recentSessionWindowSeconds: 600
  });
  assert.equal("passwordHash" in state, false);
  assert.equal("passwordSalt" in state, false);
});
