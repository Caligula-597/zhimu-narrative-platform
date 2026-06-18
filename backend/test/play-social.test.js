import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, playerUserId } from "./helpers/fixture-ids.js";

test("plaza replies, reports, friends and DM", async () => {
  process.env.PLAY_SOCIAL_ACCOUNT_COOLDOWN_MIN = "0";
  process.env.PLAY_SOCIAL_REQUIRE_VERIFIED_EMAIL = "false";
  await query(
    `DELETE FROM play_friendships
     WHERE (user_low_id = $1 AND user_high_id = $2)
        OR (user_low_id = $2 AND user_high_id = $1)`,
    [playerUserId, hostUserId]
  );
  const app = await createApp();

  const postRes = await app.inject({
    method: "POST",
    url: "/api/platform/plaza/posts",
    headers: { "x-user-id": playerUserId, "content-type": "application/json" },
    payload: { kind: "chat", body: "社交功能联调帖" }
  });
  assert.equal(postRes.statusCode, 201);
  const postId = postRes.json().id;

  const replyRes = await app.inject({
    method: "POST",
    url: `/api/platform/plaza/posts/${postId}/replies`,
    headers: { "x-user-id": hostUserId, "content-type": "application/json" },
    payload: { body: "我来评论一下" }
  });
  assert.equal(replyRes.statusCode, 201);
  const replyId = replyRes.json().id;

  const repliesListed = await app.inject({
    method: "GET",
    url: `/api/platform/plaza/posts/${postId}/replies`
  });
  assert.equal(repliesListed.statusCode, 200);
  assert.equal(repliesListed.json().items.length, 1);

  const reportRes = await app.inject({
    method: "POST",
    url: "/api/platform/plaza/reports",
    headers: { "x-user-id": hostUserId, "content-type": "application/json" },
    payload: { targetType: "post", targetId: postId, reason: "测试举报流程" }
  });
  assert.equal(reportRes.statusCode, 201);

  const friendReq = await app.inject({
    method: "POST",
    url: "/api/platform/social/friends/request",
    headers: { "x-user-id": playerUserId, "content-type": "application/json" },
    payload: { targetUserId: hostUserId }
  });
  assert.equal(friendReq.statusCode, 201);

  const accept = await app.inject({
    method: "POST",
    url: "/api/platform/social/friends/respond",
    headers: { "x-user-id": hostUserId, "content-type": "application/json" },
    payload: { targetUserId: playerUserId, accept: true }
  });
  assert.equal(accept.statusCode, 200);

  const openDm = await app.inject({
    method: "POST",
    url: "/api/platform/social/dm/conversations",
    headers: { "x-user-id": playerUserId, "content-type": "application/json" },
    payload: { peerUserId: hostUserId }
  });
  assert.equal(openDm.statusCode, 201);
  const conversationId = openDm.json().conversationId;

  const sendMsg = await app.inject({
    method: "POST",
    url: `/api/platform/social/dm/conversations/${conversationId}/messages`,
    headers: { "x-user-id": playerUserId, "content-type": "application/json" },
    payload: { body: "你好，一起测本吗？" }
  });
  assert.equal(sendMsg.statusCode, 201);

  const inbox = await app.inject({
    method: "GET",
    url: "/api/platform/social/dm/conversations",
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(inbox.statusCode, 200);
  assert.ok(inbox.json().items.some((item) => item.id === conversationId));

  const deleteReply = await app.inject({
    method: "DELETE",
    url: `/api/platform/plaza/replies/${replyId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(deleteReply.statusCode, 200);

  const deletePost = await app.inject({
    method: "DELETE",
    url: `/api/platform/plaza/posts/${postId}`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(deletePost.statusCode, 200);

  const blockedPost = await app.inject({
    method: "POST",
    url: "/api/platform/plaza/posts",
    headers: { "x-user-id": playerUserId, "content-type": "application/json" },
    payload: { kind: "chat", body: "扫码进群领优惠券，加微信 abc123" }
  });
  assert.equal(blockedPost.statusCode, 422);
  assert.equal(blockedPost.json().code, "PLAY_CONTENT_AD");

  const dmAd = await app.inject({
    method: "POST",
    url: `/api/platform/social/dm/conversations/${conversationId}/messages`,
    headers: { "x-user-id": hostUserId, "content-type": "application/json" },
    payload: { body: "扫码进群领优惠券，加微信 abc123" }
  });
  assert.equal(dmAd.statusCode, 422);
  assert.equal(dmAd.json().code, "PLAY_CONTENT_AD");

  await query(
    `DELETE FROM play_friendships
     WHERE (user_low_id = $1 AND user_high_id = $2)
        OR (user_low_id = $2 AND user_high_id = $1)`,
    [playerUserId, hostUserId]
  );
  await query(`DELETE FROM play_dm_conversations WHERE id = $1`, [conversationId]);
});
