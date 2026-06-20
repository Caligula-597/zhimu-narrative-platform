import assert from "node:assert/strict";
import test from "node:test";
import {
  betaRejectEmailHtml,
  importDeliveryEmailHtml,
  SUPPORT_EMAIL_TEMPLATES
} from "../src/email/support-templates.js";

test("betaRejectEmailHtml includes note and reply-friendly footer", () => {
  const { subject, html } = betaRejectEmailHtml({
    displayName: "测试用户",
    note: "请补充角色数与试跑计划"
  });
  assert.match(subject, /内测申请/);
  assert.match(html, /请补充角色数/);
  assert.match(html, /直接回复本邮件/);
  assert.match(html, /免费注册体验/);
});

test("importDeliveryEmailHtml embeds invite join link", () => {
  const { html } = importDeliveryEmailHtml({
    displayName: "工作室",
    worldName: "夜行",
    inviteCode: "TEST-CODE"
  });
  assert.match(html, /夜行/);
  assert.match(html, /TEST-CODE/);
  assert.match(html, /join=TEST-CODE/);
});

test("SUPPORT_EMAIL_TEMPLATES registry covers manual ops templates", () => {
  assert.ok(SUPPORT_EMAIL_TEMPLATES["import-ack"]);
  assert.ok(SUPPORT_EMAIL_TEMPLATES["import-delivery"]);
  assert.equal(SUPPORT_EMAIL_TEMPLATES["beta-reject"].required.includes("note"), true);
});
