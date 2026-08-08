import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { clearTestEmailCapture, peekTestInviteUrl } from "../src/email.js";
import { setUserPlan } from "../src/plans.js";
import { assertWorldCreateQuota, assertStorageBytesQuota } from "../src/quota-guards.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

function captureEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(saved) {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const INVITE_ENV_KEYS = ["EMAIL_PROVIDER", "EMAIL_DELIVERY_STUB", "APP_PUBLIC_URL", "MAIL_FROM"];

function inviteTestEnv() {
  process.env.EMAIL_PROVIDER = "console";
  process.env.EMAIL_DELIVERY_STUB = "1";
  process.env.APP_PUBLIC_URL = "http://127.0.0.1:4173";
  process.env.MAIL_FROM = "test@zhimu.local";
  clearTestEmailCapture();
}

function withInviteTestEnv(context) {
  const saved = captureEnv(INVITE_ENV_KEYS);
  context.before(() => inviteTestEnv());
  context.after(() => restoreEnv(saved));
}

async function createOwnerWorld(app, name = `Collab ${Date.now()}`) {
  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name }
  });
  assert.equal(created.statusCode, 201, created.body);
  return created.json().id;
}

test("pending invite sends email stub URL and hides token when configured", async (context) => {
  withInviteTestEnv(context);
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const worldId = await createOwnerWorld(app);
  const email = `invite-mail-${Date.now()}@example.com`;
  context.after(async () => {
    await query(`DELETE FROM world_member_invites WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const invited = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/members`,
    headers: { "x-user-id": hostUserId },
    payload: { email, role: "editor" }
  });
  assert.equal(invited.statusCode, 201, invited.body);
  const body = invited.json();
  assert.equal(body.pendingInvite, true);
  assert.equal(body.emailSent, true);
  assert.equal(body.inviteToken, undefined);
  const inviteUrl = peekTestInviteUrl();
  assert.ok(inviteUrl?.includes("invite="));
});

test("invite rejects self, invalid email, and duplicate member", async (context) => {
  withInviteTestEnv(context);
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const worldId = await createOwnerWorld(app);
  context.after(async () => {
    await query(`DELETE FROM world_member_invites WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const self = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/members`,
    headers: { "x-user-id": hostUserId },
    payload: { email: "host@zhimu.local", role: "editor" }
  });
  assert.equal(self.statusCode, 400);
  assert.equal(self.json().code, "WORLD_INVITE_SELF");

  const bad = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/members`,
    headers: { "x-user-id": hostUserId },
    payload: { email: "not-an-email", role: "editor" }
  });
  assert.equal(bad.statusCode, 400);
  assert.equal(bad.json().code, "EMAIL_INVALID");

  const dupAdd = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/members`,
    headers: { "x-user-id": hostUserId },
    payload: { email: "player@zhimu.local", role: "viewer" }
  });
  assert.equal(dupAdd.statusCode, 201, dupAdd.body);

  const dup = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/members`,
    headers: { "x-user-id": hostUserId },
    payload: { email: "player@zhimu.local", role: "viewer" }
  });
  assert.equal(dup.statusCode, 409);
  assert.equal(dup.json().code, "COLLABORATOR_ALREADY_MEMBER");
});

test("non-owner cannot invite collaborators", async (context) => {
  withInviteTestEnv(context);
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const worldId = await createOwnerWorld(app);
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const denied = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/members`,
    headers: { "x-user-id": "1d5e8155-a80f-4e7f-99f0-0ae317a35f35" },
    payload: { email: `blocked-${Date.now()}@example.com`, role: "editor" }
  });
  assert.equal(denied.statusCode, 403);
});

test("accept invite token requires matching registered email", async (context) => {
  withInviteTestEnv(context);
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const ownerWorld = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Accept invite ${Date.now()}` }
  });
  const worldId = ownerWorld.json().id;
  const inviteEmail = `accept-${Date.now()}@zhimu.local`;

  const register = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: inviteEmail, displayName: "受邀者", password: "accept-pass-123" }
  });
  assert.equal(register.statusCode, 201, register.body);
  const userToken = register.json().token;
  const userId = register.json().user.id;

  const { createWorldMemberInvite } = await import("../src/world-invites.js");
  const invite = await createWorldMemberInvite({
    worldId,
    email: inviteEmail,
    role: "host",
    invitedByUserId: hostUserId
  });

  context.after(async () => {
    await query(`DELETE FROM world_members WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM world_member_invites WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
    await query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  const mismatchUser = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: `other-${Date.now()}@zhimu.local`, displayName: "其他人", password: "other-pass-123" }
  });
  const otherToken = mismatchUser.json().token;
  const otherId = mismatchUser.json().user.id;
  context.after(async () => {
    await query(`DELETE FROM users WHERE id = $1`, [otherId]);
  });

  const mismatch = await app.inject({
    method: "POST",
    url: "/api/worlds/invites/accept",
    headers: { authorization: `Bearer ${otherToken}` },
    payload: { token: invite.token }
  });
  assert.equal(mismatch.statusCode, 403);
  assert.equal(mismatch.json().code, "WORLD_INVITE_EMAIL_MISMATCH");

  const stillPending = await query(
    `SELECT accepted_at, accepted_by_user_id
     FROM world_member_invites
     WHERE id = $1`,
    [invite.id]
  );
  assert.equal(stillPending.rows[0]?.accepted_at, null);
  assert.equal(stillPending.rows[0]?.accepted_by_user_id, null);

  const accepted = await app.inject({
    method: "POST",
    url: "/api/worlds/invites/accept",
    headers: { authorization: `Bearer ${userToken}` },
    payload: { token: invite.token }
  });
  assert.equal(accepted.statusCode, 200, accepted.body);
  assert.equal(accepted.json().role, "host");
});

test("owner can revoke and resend pending invite", async (context) => {
  withInviteTestEnv(context);
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const worldId = await createOwnerWorld(app);
  const email = `resend-${Date.now()}@example.com`;
  context.after(async () => {
    await query(`DELETE FROM world_member_invites WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const invited = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/members`,
    headers: { "x-user-id": hostUserId },
    payload: { email, role: "viewer" }
  });
  const inviteId = invited.json().id;

  const resent = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/invites/${inviteId}/resend`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(resent.statusCode, 200);
  assert.equal(resent.json().emailSent, true);

  const revoked = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/invites/${inviteId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(revoked.statusCode, 200);

  const missing = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/invites/${inviteId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().code, "WORLD_INVITE_NOT_FOUND");
});

test("world quota exceeded returns structured details", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const beforePlan = (await query(`SELECT plan_code FROM user_plans WHERE user_id = $1`, [hostUserId])).rows[0]?.plan_code;
  const beforeQuota = await query(
    `SELECT max_worlds, max_bytes, max_single_file_bytes FROM storage_quotas WHERE user_id = $1`,
    [hostUserId]
  );
  await setUserPlan(hostUserId, "free");
  await query(
    `INSERT INTO storage_quotas (user_id, max_worlds, max_bytes, max_single_file_bytes)
     VALUES ($1, 2, 524288000, 31457280)
     ON CONFLICT (user_id) DO UPDATE SET max_worlds = 2, max_bytes = 524288000, max_single_file_bytes = 31457280`,
    [hostUserId]
  );
  const createdWorldIds = [];
  context.after(async () => {
    for (const id of createdWorldIds) {
      await query(`DELETE FROM worlds WHERE id = $1`, [id]);
    }
    if (beforePlan) await setUserPlan(hostUserId, beforePlan);
    if (beforeQuota.rowCount) {
      const q = beforeQuota.rows[0];
      await query(
        `UPDATE storage_quotas SET max_worlds = $2, max_bytes = $3, max_single_file_bytes = $4 WHERE user_id = $1`,
        [hostUserId, q.max_worlds, q.max_bytes, q.max_single_file_bytes]
      );
    }
  });

  let blocked = null;
  for (let i = 0; i < 5; i += 1) {
    const res = await app.inject({
      method: "POST",
      url: "/api/worlds",
      headers: { "x-user-id": hostUserId },
      payload: { name: `Quota probe ${Date.now()}-${i}` }
    });
    if (res.statusCode === 403) {
      blocked = res;
      break;
    }
    assert.equal(res.statusCode, 201, res.body);
    createdWorldIds.push(res.json().id);
  }
  assert.ok(blocked, "expected quota block");
  assert.equal(blocked.json().code, "WORLD_QUOTA_EXCEEDED");
  assert.equal(blocked.json().details?.quotaType, "worlds");
  assert.ok(typeof blocked.json().details?.maxWorlds === "number");
});

test("assertStorageBytesQuota throws with shortfall details", async () => {
  const row = await query(`SELECT id FROM users WHERE user_kind = 'registered' LIMIT 1`);
  const userId = row.rows[0].id;
  const before = await query(`SELECT plan_code FROM user_plans WHERE user_id = $1`, [userId]);
  await setUserPlan(userId, "free");
  try {
    await assertStorageBytesQuota(userId, 999_999_999_999);
    assert.fail("expected quota error");
  } catch (error) {
    assert.equal(error.code, "STORAGE_QUOTA_EXCEEDED");
    assert.equal(error.details?.quotaType, "storage");
    assert.ok(error.details?.shortfallBytes > 0);
  } finally {
    if (before.rows[0]?.plan_code) await setUserPlan(userId, before.rows[0].plan_code);
  }
});

test("assertWorldCreateQuota allows when under limit", async () => {
  const row = await query(`SELECT id FROM users WHERE user_kind = 'registered' LIMIT 1`);
  const usage = await assertWorldCreateQuota(row.rows[0].id);
  assert.ok(usage.max_worlds > 0);
});
