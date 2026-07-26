import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import {
  listPlazaHumanReviewQueue,
  opsApprovePlazaReply
} from "../src/play-plaza-ops.js";
import { hostUserId, playerUserId } from "./helpers/fixture-ids.js";

test("manual plaza review queues replies instead of rejecting every comment", async (context) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousReviewMode = process.env.PLAY_PLAZA_AI_REVIEW;
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  let postId = null;

  context.after(async () => {
    if (postId) await query(`DELETE FROM play_plaza_posts WHERE id = $1`, [postId]);
    await app.close();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousReviewMode === undefined) delete process.env.PLAY_PLAZA_AI_REVIEW;
    else process.env.PLAY_PLAZA_AI_REVIEW = previousReviewMode;
  });

  process.env.NODE_ENV = "test";
  process.env.PLAY_PLAZA_AI_REVIEW = "stub";
  const postResponse = await app.inject({
    method: "POST",
    url: "/api/platform/plaza/posts",
    headers: { "x-user-id": playerUserId, "content-type": "application/json" },
    payload: { kind: "chat", body: "评论人工复核功能验证" }
  });
  assert.equal(postResponse.statusCode, 201, postResponse.body);
  postId = postResponse.json().id;

  process.env.NODE_ENV = "production";
  process.env.PLAY_PLAZA_AI_REVIEW = "off";
  const replyResponse = await app.inject({
    method: "POST",
    url: `/api/platform/plaza/posts/${postId}/replies`,
    headers: { "x-user-id": hostUserId, "content-type": "application/json" },
    payload: { body: "这是一条等待人工复核的正常评论" }
  });
  assert.equal(replyResponse.statusCode, 201, replyResponse.body);
  assert.equal(replyResponse.json().reviewStatus, "human_review");
  assert.equal(replyResponse.json().reviewPending, true);
  const replyId = replyResponse.json().id;

  const beforeApproval = await query(
    `SELECT review_status, published_at FROM play_plaza_replies WHERE id = $1`,
    [replyId]
  );
  assert.equal(beforeApproval.rows[0].review_status, "human_review");
  assert.equal(beforeApproval.rows[0].published_at, null);

  const publicList = await app.inject({
    method: "GET",
    url: `/api/platform/plaza/posts/${postId}/replies`
  });
  assert.equal(publicList.statusCode, 200, publicList.body);
  assert.equal(publicList.json().items.some((item) => item.id === replyId), false);

  const authorList = await app.inject({
    method: "GET",
    url: `/api/platform/plaza/posts/${postId}/replies`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(authorList.statusCode, 200, authorList.body);
  assert.equal(authorList.json().items.some((item) => item.id === replyId), true);

  const queue = await listPlazaHumanReviewQueue({ limit: 200 });
  assert.equal(queue.replies.some((item) => item.id === replyId), true);

  await opsApprovePlazaReply(replyId, { note: "人工复核通过" });
  const approvedList = await app.inject({
    method: "GET",
    url: `/api/platform/plaza/posts/${postId}/replies`
  });
  assert.equal(approvedList.statusCode, 200, approvedList.body);
  assert.equal(approvedList.json().items.some((item) => item.id === replyId), true);

  const post = await query(`SELECT reply_count FROM play_plaza_posts WHERE id = $1`, [postId]);
  assert.equal(post.rows[0].reply_count, 1);
});
