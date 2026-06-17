#!/usr/bin/env node
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const app = await createApp({ logger: false, allowDemoUserHeader: true });
const checks = [];

async function ok(name, fn) {
  try {
    await fn();
    checks.push({ ok: true, name });
  } catch (error) {
    checks.push({ ok: false, name, error: error.message });
  }
}

await ok("guest -> join fog harbor", async () => {
  const g = await app.inject({ method: "POST", url: "/api/auth/guest", payload: { displayName: "冒烟游客" } });
  if (g.statusCode !== 201) throw new Error(g.body);
  const { token, user } = g.json();
  const roles = await app.inject({
    method: "GET",
    url: "/api/rooms/invite/TEST-FIXTURE-DEMO",
    headers: { authorization: `Bearer ${token}` }
  });
  const open = roles.json().roles.find((r) => !r.occupied);
  if (!open) throw new Error("no open role");
  const join = await app.inject({
    method: "POST",
    url: "/api/rooms/join",
    headers: { authorization: `Bearer ${token}` },
    payload: { inviteCode: "TEST-FIXTURE-DEMO", roleSlotId: open.id }
  });
  if (join.statusCode !== 200) throw new Error(join.body);
  await query("DELETE FROM room_members WHERE user_id = $1", [user.id]);
  await query("DELETE FROM users WHERE id = $1", [user.id]);
});

await ok("auth config exposes oauth array", async () => {
  const r = await app.inject({ method: "GET", url: "/api/auth/config" });
  if (!Array.isArray(r.json().oauth)) throw new Error("missing oauth");
});

await ok("guest blocked from create world", async () => {
  const g = await app.inject({ method: "POST", url: "/api/auth/guest", payload: {} });
  const { token, user } = g.json();
  const w = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "x" }
  });
  if (w.statusCode !== 403 || w.json().code !== "GUEST_ACCOUNT_RESTRICTED") throw new Error(w.body);
  await query("DELETE FROM users WHERE id = $1", [user.id]);
});

await ok("pending invite + register auto-accept", async () => {
  const host = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": host },
    payload: { name: `Smoke invite ${Date.now()}` }
  });
  const worldId = created.json().id;
  const email = `smoke-inv-${Date.now()}@zhimu.local`;
  await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/members`,
    headers: { "x-user-id": host },
    payload: { email, role: "viewer" }
  });
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, displayName: "Smoke", password: "smoke-pass-12" }
  });
  if (!reg.json().acceptedInvites?.length) throw new Error("invite not auto-accepted");
  const userId = reg.json().user.id;
  await query("DELETE FROM world_members WHERE user_id = $1", [userId]);
  await query("DELETE FROM world_member_invites WHERE world_id = $1", [worldId]);
  await query("DELETE FROM worlds WHERE id = $1", [worldId]);
  await query("DELETE FROM users WHERE id = $1", [userId]);
});

await app.close();

for (const row of checks) {
  console.log(row.ok ? "OK" : "FAIL", row.name, row.error ?? "");
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) process.exit(1);
console.log(`\nSmoke: ${checks.length}/${checks.length} identity checks passed`);
