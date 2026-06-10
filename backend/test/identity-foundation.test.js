import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { CAPABILITIES, assertCapability, USER_KIND } from "../src/capabilities.js";
import { effectiveStorageLimits, setUserPlan } from "../src/plans.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const fogWorldId = "08646748-e4ae-446a-a5e7-ce59ca23ffc3";

async function guestSession(app) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/guest",
    payload: { displayName: "测试游客", deviceLabel: "e2e-phone" }
  });
  assert.equal(response.statusCode, 201, response.body);
  const body = response.json();
  assert.equal(body.user.isGuest, true);
  assert.ok(body.token);
  return body;
}

test("capabilities registry covers core account gates", () => {
  assert.ok(CAPABILITIES["world.create"]);
  assert.ok(CAPABILITIES["room.join"].accountKinds.includes(USER_KIND.GUEST));
  assert.ok(!CAPABILITIES["world.create"].accountKinds.includes(USER_KIND.GUEST));
});

test("POST /auth/guest creates guest session and /auth/me reflects kind", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const guest = await guestSession(app);
  context.after(async () => {
    await query(`DELETE FROM users WHERE id = $1`, [guest.user.id]);
  });

  const me = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${guest.token}` }
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().userKind, "guest");
  assert.equal(me.json().isGuest, true);
});

test("guest cannot create worlds but can join a room with invite code", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const guest = await guestSession(app);
  context.after(async () => {
    await query(`DELETE FROM room_members WHERE user_id = $1`, [guest.user.id]);
    await query(`DELETE FROM users WHERE id = $1`, [guest.user.id]);
  });

  const denied = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${guest.token}` },
    payload: { name: "游客世界" }
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.json().code, "GUEST_ACCOUNT_RESTRICTED");

  const roles = await app.inject({
    method: "GET",
    url: "/api/rooms/invite/FOG-HARBOR-DEMO",
    headers: { authorization: `Bearer ${guest.token}` }
  });
  assert.equal(roles.statusCode, 200);
  const openRole = roles.json().roles.find((role) => !role.occupied);
  assert.ok(openRole, "need an open role in fog harbor fixture");

  const joined = await app.inject({
    method: "POST",
    url: "/api/rooms/join",
    headers: { authorization: `Bearer ${guest.token}` },
    payload: { inviteCode: "FOG-HARBOR-DEMO", roleSlotId: openRole.id }
  });
  assert.equal(joined.statusCode, 200, joined.body);
  assert.equal(joined.json().ok, true);
});

test("guest upgrade binds email and revokes old sessions", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const guest = await guestSession(app);
  const email = `guest-upgrade-${Date.now()}@zhimu.local`;

  const upgraded = await app.inject({
    method: "POST",
    url: "/api/auth/upgrade",
    headers: { authorization: `Bearer ${guest.token}` },
    payload: {
      email,
      displayName: "升级玩家",
      password: "secure-pass-123"
    }
  });
  assert.equal(upgraded.statusCode, 200, upgraded.body);
  assert.equal(upgraded.json().user.isGuest, false);
  assert.ok(upgraded.json().token);

  const old = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${guest.token}` }
  });
  assert.equal(old.statusCode, 401);

  context.after(async () => {
    await query(`DELETE FROM users WHERE id = $1`, [upgraded.json().user.id]);
  });
});

test("session list and revoke other device", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const email = `sessions-${Date.now()}@zhimu.local`;
  const password = "session-test-pass-1";
  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, displayName: "Session Test", password }
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const userId = registered.json().user.id;
  const tokenA = registered.json().token;
  context.after(async () => {
    await query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  const loginB = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
    headers: { "x-device-label": "tablet" }
  });
  assert.equal(loginB.statusCode, 200);
  const tokenB = loginB.json().token;

  const list = await app.inject({
    method: "GET",
    url: "/api/auth/sessions",
    headers: { authorization: `Bearer ${tokenA}` }
  });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().sessions.length >= 2);

  const other = list.json().sessions.find((s) => !s.isCurrent);
  assert.ok(other);

  const revoked = await app.inject({
    method: "DELETE",
    url: `/api/auth/sessions/${other.id}`,
    headers: { authorization: `Bearer ${tokenA}` }
  });
  assert.equal(revoked.statusCode, 200);

  const dead = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${tokenB}` }
  });
  assert.equal(dead.statusCode, 401);
});

test("unregistered collaborator invite returns pendingInvite token", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Invite gate ${Date.now()}` }
  });
  assert.equal(created.statusCode, 201);
  const worldId = created.json().id;
  context.after(async () => {
    await query(`DELETE FROM world_member_invites WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const email = `pending-${Date.now()}@example.com`;
  const invited = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/members`,
    headers: { "x-user-id": hostUserId },
    payload: { email, role: "editor" }
  });
  assert.equal(invited.statusCode, 201, invited.body);
  assert.equal(invited.json().pendingInvite, true);
  assert.ok(invited.json().inviteToken || invited.json().emailSent === true);

  const members = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/members`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(members.statusCode, 200);
  assert.equal(members.json().pendingInvites.length, 1);
  assert.equal(members.json().members.length >= 1, true);
});

test("register auto-accepts pending world invite for same email", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Register invite ${Date.now()}` }
  });
  const worldId = created.json().id;
  const email = `auto-accept-${Date.now()}@zhimu.local`;

  await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/members`,
    headers: { "x-user-id": hostUserId },
    payload: { email, role: "editor" }
  });

  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, displayName: "受邀协作者", password: "invite-pass-123" }
  });
  assert.equal(registered.statusCode, 201, registered.body);
  assert.equal(registered.json().acceptedInvites?.length, 1);
  const userId = registered.json().user.id;

  context.after(async () => {
    await query(`DELETE FROM world_members WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM world_member_invites WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
    await query(`DELETE FROM users WHERE id = $1`, [userId]);
  });

  const row = await query(
    `SELECT role FROM world_members WHERE world_id = $1 AND user_id = $2`,
    [worldId, userId]
  );
  assert.equal(row.rows[0]?.role, "editor");
});

test("plan code raises effective storage limits", async () => {
  const row = await query(`SELECT id FROM users WHERE user_kind = 'registered' LIMIT 1`);
  const userId = row.rows[0].id;
  const before = await effectiveStorageLimits(userId);
  await setUserPlan(userId, "creator");
  const upgraded = await effectiveStorageLimits(userId);
  assert.equal(upgraded.planCode, "creator");
  assert.ok(upgraded.max_worlds >= before.max_worlds);
  assert.ok(upgraded.max_worlds >= 10);
  await setUserPlan(userId, before.planCode);
});

test("assertCapability rejects guest for world.create", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());
  const guest = await guestSession(app);
  context.after(async () => {
    await query(`DELETE FROM users WHERE id = $1`, [guest.user.id]);
  });
  await assert.rejects(() => assertCapability(guest.user.id, "world.create"), (err) => {
    assert.equal(err.code, "GUEST_ACCOUNT_RESTRICTED");
    return true;
  });
});
