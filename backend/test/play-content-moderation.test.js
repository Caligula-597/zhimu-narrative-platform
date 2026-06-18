import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPlaySocialContentAllowed,
  resetPlayContentModerationForTests,
  scanPlaySocialAdContent,
  scanPlaySocialContent
} from "../src/play-content-moderation.js";

test("scanPlaySocialContent allows normal plaza chat", () => {
  resetPlayContentModerationForTests();
  assert.deepEqual(scanPlaySocialContent("有人一起测本吗？晚上八点后在线。"), { ok: true });
  assert.deepEqual(scanPlaySocialContent("缺 2 人，欢迎萌新，题材偏推理。"), { ok: true });
});

test("scanPlaySocialContent blocks advertising patterns", () => {
  resetPlayContentModerationForTests();
  assert.equal(scanPlaySocialContent("加微信 abc123 领福利").ok, false);
  assert.equal(scanPlaySocialContent("扫码进群领优惠券").reason, "ad");
  assert.equal(scanPlaySocialContent("访问 www.example-shop.com 下单").reason, "ad");
  assert.equal(scanPlaySocialContent("联系 13800138000 详谈").reason, "ad");
  assert.equal(scanPlaySocialContent("加 v x 私聊").reason, "ad");
});

test("scanPlaySocialAdContent blocks ads only", () => {
  resetPlayContentModerationForTests();
  assert.equal(scanPlaySocialAdContent("加微信 abc123").ok, false);
  assert.equal(scanPlaySocialAdContent("有人一起测本吗？").ok, true);
});

test("scanPlaySocialContent blocks forbidden terms beyond ads", () => {
  resetPlayContentModerationForTests();
  assert.equal(scanPlaySocialContent("网赌平台").reason, "forbidden");
});

test("assertPlaySocialContentAllowed throws typed errors", () => {
  resetPlayContentModerationForTests();
  assert.throws(
    () => assertPlaySocialContentAllowed("兼职日结扫码加群"),
    (error) => error.code === "PLAY_CONTENT_AD"
  );
  assert.throws(
    () => assertPlaySocialContentAllowed("网赌平台"),
    (error) => error.code === "PLAY_CONTENT_FORBIDDEN"
  );
});
