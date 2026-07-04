import assert from "node:assert/strict";
import test from "node:test";
import { enterpriseEmails, enterpriseEmailSummary } from "../src/enterprise-emails.js";

test("enterpriseEmails defaults to support / hello / admin", () => {
  const prev = {
    MAIL_FROM: process.env.MAIL_FROM,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
    HELLO_EMAIL: process.env.HELLO_EMAIL,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    BETA_REVIEW_NOTIFY_EMAIL: process.env.BETA_REVIEW_NOTIFY_EMAIL
  };
  delete process.env.MAIL_FROM;
  delete process.env.SUPPORT_EMAIL;
  delete process.env.HELLO_EMAIL;
  delete process.env.ADMIN_EMAIL;
  delete process.env.BETA_REVIEW_NOTIFY_EMAIL;
  delete process.env.CATALOG_REVIEW_NOTIFY_EMAIL;
  delete process.env.PLAN_UPGRADE_NOTIFY_EMAIL;
  delete process.env.ALERT_EMAIL;
  delete process.env.OPS_NOTIFY_EMAIL;
  delete process.env.MAIL_REPLY_TO;

  try {
    const e = enterpriseEmails();
    assert.match(e.mailFrom, /noreply@mail\.getzhimu\.com/);
    assert.equal(e.support, "support@getzhimu.com");
    assert.equal(e.hello, "hello@getzhimu.com");
    assert.equal(e.admin, "admin@getzhimu.com");
    assert.equal(e.betaReviewNotify, "admin@getzhimu.com");
    assert.equal(e.mailReplyTo, "support@getzhimu.com");

    const summary = enterpriseEmailSummary();
    assert.equal(summary.userSupport, "support@getzhimu.com");
    assert.equal(summary.hello, "hello@getzhimu.com");
    assert.equal(summary.admin, "admin@getzhimu.com");
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("enterpriseEmails honors explicit notify overrides", () => {
  const prev = process.env.BETA_REVIEW_NOTIFY_EMAIL;
  process.env.BETA_REVIEW_NOTIFY_EMAIL = "ops-desk@example.test";
  try {
    assert.equal(enterpriseEmails().betaReviewNotify, "ops-desk@example.test");
  } finally {
    if (prev === undefined) delete process.env.BETA_REVIEW_NOTIFY_EMAIL;
    else process.env.BETA_REVIEW_NOTIFY_EMAIL = prev;
  }
});
