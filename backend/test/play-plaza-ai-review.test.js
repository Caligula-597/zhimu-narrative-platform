import assert from "node:assert/strict";
import test from "node:test";
import { reviewPlazaPostContent, resetPlazaAiReviewModeForTests } from "../src/play-plaza-ai-review.js";

test("reviewPlazaPostContent stub approves normal chat", async () => {
  resetPlazaAiReviewModeForTests();
  process.env.PLAY_PLAZA_AI_REVIEW = "stub";
  const result = await reviewPlazaPostContent({ kind: "chat", body: "有人一起测本吗？" });
  assert.equal(result.decision, "approve");
});

test("reviewPlazaPostContent stub rejects obvious ads", async () => {
  resetPlazaAiReviewModeForTests();
  process.env.PLAY_PLAZA_AI_REVIEW = "stub";
  const result = await reviewPlazaPostContent({
    kind: "chat",
    body: "扫码进群领优惠券，加微信 abc123"
  });
  assert.equal(result.decision, "reject");
  assert.ok(result.feedback);
});
