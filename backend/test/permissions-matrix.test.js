import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";
const fogWorldId = "08646748-e4ae-446a-a5e7-ce59ca23ffc3";

async function guestToken(app) {
  const res = await app.inject({ method: "POST", url: "/api/auth/guest", payload: { displayName: "矩阵游客" } });
  assert.equal(res.statusCode, 201, res.body);
  return { token: res.json().token, userId: res.json().user.id };
}

test("permission matrix — core write routes enforce account/world roles", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const guest = await guestToken(app);
  context.after(async () => {
    await query(`DELETE FROM users WHERE id = $1`, [guest.userId]);
  });

  const matrix = [
    {
      name: "guest cannot create world",
      method: "POST",
      url: "/api/worlds",
      headers: { authorization: `Bearer ${guest.token}` },
      body: { name: "Guest world" },
      expectCode: "GUEST_ACCOUNT_RESTRICTED"
    },
    {
      name: "player cannot invite collaborator",
      method: "POST",
      url: `/api/worlds/${fogWorldId}/members`,
      headers: { "x-user-id": playerUserId },
      body: { email: "blocked@example.com", role: "editor" },
      expectStatus: 403
    },
    {
      name: "player cannot delete world",
      method: "DELETE",
      url: `/api/worlds/${fogWorldId}`,
      headers: { "x-user-id": playerUserId },
      expectStatus: 403
    },
    {
      name: "player cannot patch catalog visibility",
      method: "PATCH",
      url: `/api/worlds/${fogWorldId}/catalog`,
      headers: { "x-user-id": playerUserId },
      body: { catalogPublic: true },
      expectCode: "WORLD_OWNER_REQUIRED"
    },
    {
      name: "unauthenticated cannot read world members",
      method: "GET",
      url: `/api/worlds/${fogWorldId}/members`,
      expectStatus: 401
    },
    {
      name: "host cannot resend invites (owner only)",
      method: "POST",
      url: `/api/worlds/${fogWorldId}/invites/00000000-0000-4000-8000-000000000001/resend`,
      headers: { "x-user-id": playerUserId },
      expectStatus: 403
    }
  ];

  for (const row of matrix) {
    const res = await app.inject({
      method: row.method,
      url: row.url,
      headers: row.headers,
      payload: row.body
    });
    if (row.expectCode) {
      assert.equal(res.statusCode >= 400, true, `${row.name}: ${res.body}`);
      assert.equal(res.json().code, row.expectCode, `${row.name}: ${res.body}`);
    } else {
      assert.equal(res.statusCode, row.expectStatus, `${row.name}: ${res.body}`);
    }
  }
});

test("permission matrix — guest cannot accept world invite", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const guest = await guestToken(app);
  context.after(async () => {
    await query(`DELETE FROM users WHERE id = $1`, [guest.userId]);
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/worlds/invites/accept",
    headers: { authorization: `Bearer ${guest.token}` },
    payload: { token: "a".repeat(32) }
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().code, "GUEST_ACCOUNT_RESTRICTED");
});

test("permission matrix — owner can list members", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: `/api/worlds/${fogWorldId}/members`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.json().members));
});
