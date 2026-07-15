import assert from "node:assert/strict";
import test from "node:test";
import {
  createSession,
  deleteSession,
  resolveSessionContext,
  resolveSessionTouchIntervalSeconds
} from "../src/auth.js";
import { query } from "../src/db.js";
import { hostUserId } from "./helpers/fixture-ids.js";

test("session touch interval is bounded", () => {
  assert.equal(resolveSessionTouchIntervalSeconds(undefined), 300);
  assert.equal(resolveSessionTouchIntervalSeconds("60"), 60);
  assert.equal(resolveSessionTouchIntervalSeconds("0"), 300);
});

test("session validation touches last_seen_at only after the configured interval", async (context) => {
  const session = await createSession(hostUserId, { ttlMs: 60_000, deviceLabel: "touch-test" });
  context.after(() => deleteSession(session.token));

  const readLastSeen = async () => (await query(
    `SELECT last_seen_at FROM auth_sessions WHERE id = $1`,
    [session.sessionId]
  )).rows[0].last_seen_at;

  const initial = await readLastSeen();
  const resolved = await resolveSessionContext(session.token);
  assert.equal(resolved.userId, hostUserId);
  assert.equal((await readLastSeen()).getTime(), initial.getTime());

  await query(
    `UPDATE auth_sessions SET last_seen_at = now() - interval '10 minutes' WHERE id = $1`,
    [session.sessionId]
  );
  const stale = await readLastSeen();
  await resolveSessionContext(session.token);
  assert.ok((await readLastSeen()).getTime() > stale.getTime());
});
