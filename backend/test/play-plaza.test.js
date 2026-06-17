import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { playerUserId } from "./helpers/fixture-ids.js";

test("GET /api/platform/plaza/posts returns recent posts", async () => {
  const app = await createApp();
  const response = await app.inject({ method: "GET", url: "/api/platform/plaza/posts?limit=10" });
  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.json().items));
});

test("POST /api/platform/plaza/posts creates chat and recruit posts", async () => {
  const app = await createApp();
  const chat = await app.inject({
    method: "POST",
    url: "/api/platform/plaza/posts",
    headers: { "x-user-id": playerUserId, "content-type": "application/json" },
    payload: { kind: "chat", body: "有人一起测本吗？晚上八点后在线。" }
  });
  assert.equal(chat.statusCode, 201);
  assert.equal(chat.json().kind, "chat");

  const recruit = await app.inject({
    method: "POST",
    url: "/api/platform/plaza/posts",
    headers: { "x-user-id": playerUserId, "content-type": "application/json" },
    payload: { kind: "recruit", body: "缺 2 人，欢迎萌新", inviteCode: "NOT-A-REAL-CODE" }
  });
  assert.equal(recruit.statusCode, 201);
  assert.equal(recruit.json().kind, "recruit");

  const listed = await app.inject({
    method: "GET",
    url: "/api/platform/plaza/posts?kind=recruit&limit=5"
  });
  assert.ok(listed.json().items.some((item) => item.id === recruit.json().id));

  await query(`DELETE FROM play_plaza_posts WHERE id = ANY($1::uuid[])`, [
    [chat.json().id, recruit.json().id]
  ]);
});
