import assert from "node:assert/strict";
import test from "node:test";
import { acceptWorldMemberInviteToken } from "../src/world-invites.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const INVITE_ID = "22222222-2222-4222-8222-222222222222";
const WORLD_ID = "33333333-3333-4333-8333-333333333333";

function transactionHarness({ userEmail, inviteEmail }) {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (/SELECT user_kind, email FROM users/u.test(sql)) {
        return { rowCount: 1, rows: [{ user_kind: "registered", email: userEmail }] };
      }
      if (/SELECT id, world_id, role, email/u.test(sql)) {
        return {
          rowCount: 1,
          rows: [{ id: INVITE_ID, world_id: WORLD_ID, role: "host", email: inviteEmail }]
        };
      }
      if (/UPDATE world_member_invites/u.test(sql)) {
        return { rowCount: 1, rows: [{ world_id: WORLD_ID, role: "host" }] };
      }
      if (/INSERT INTO world_members/u.test(sql)) return { rowCount: 1, rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
  return {
    statements,
    transactionRunner: async (work) => work(client)
  };
}

test("wrong-account invite acceptance validates email before consuming the invite", async () => {
  const harness = transactionHarness({
    userEmail: "wrong@example.com",
    inviteEmail: "invited@example.com"
  });
  await assert.rejects(
    () => acceptWorldMemberInviteToken(USER_ID, "a".repeat(32), harness),
    (error) => error.code === "WORLD_INVITE_EMAIL_MISMATCH" && error.statusCode === 403
  );
  assert.equal(harness.statements.some((sql) => /UPDATE world_member_invites/u.test(sql)), false);
  assert.equal(harness.statements.some((sql) => /INSERT INTO world_members/u.test(sql)), false);
  assert.ok(harness.statements.every((sql) => /FOR UPDATE/u.test(sql)));
});

test("matching invite acceptance consumes and grants membership in one transaction", async () => {
  const harness = transactionHarness({
    userEmail: "Invited@Example.com",
    inviteEmail: "invited@example.com"
  });
  const result = await acceptWorldMemberInviteToken(USER_ID, "b".repeat(32), harness);
  assert.deepEqual(result, { worldId: WORLD_ID, role: "host" });
  assert.equal(harness.statements.filter((sql) => /UPDATE world_member_invites/u.test(sql)).length, 1);
  assert.equal(harness.statements.filter((sql) => /INSERT INTO world_members/u.test(sql)).length, 1);
});
