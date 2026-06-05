import assert from "node:assert/strict";
import test from "node:test";
import {
  clearTestEmailCapture,
  getEmailProvider,
  isEmailConfigured,
  peekTestVerifyUrl
} from "../src/email.js";

const ENV_KEYS = [
  "EMAIL_PROVIDER",
  "RESEND_API_KEY",
  "SENDGRID_API_KEY",
  "MAILGUN_API_KEY",
  "MAILGUN_DOMAIN",
  "MAIL_FROM",
  "APP_PUBLIC_URL"
];

function saveEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

test("isEmailConfigured respects EMAIL_PROVIDER routes", async (context) => {
  const saved = saveEnv();
  context.after(() => restoreEnv(saved));

  process.env.MAIL_FROM = "织幕 <noreply@example.invalid>";
  process.env.APP_PUBLIC_URL = "https://app.example.invalid";

  process.env.EMAIL_PROVIDER = "resend";
  delete process.env.SENDGRID_API_KEY;
  delete process.env.MAILGUN_API_KEY;
  process.env.RESEND_API_KEY = "re_test";
  assert.equal(isEmailConfigured(), true);

  delete process.env.RESEND_API_KEY;
  assert.equal(isEmailConfigured(), false);

  process.env.EMAIL_PROVIDER = "sendgrid";
  process.env.SENDGRID_API_KEY = "sg_test";
  assert.equal(isEmailConfigured(), true);

  process.env.EMAIL_PROVIDER = "mailgun";
  delete process.env.SENDGRID_API_KEY;
  process.env.MAILGUN_API_KEY = "mg_test";
  process.env.MAILGUN_DOMAIN = "mg.example.invalid";
  assert.equal(isEmailConfigured(), true);

  process.env.EMAIL_PROVIDER = "console";
  delete process.env.MAILGUN_API_KEY;
  delete process.env.MAILGUN_DOMAIN;
  assert.equal(isEmailConfigured(), true);
  assert.equal(getEmailProvider(), "console");
});

test("sendEmailVerificationEmail captures verify URL in stub mode", async (context) => {
  const saved = saveEnv();
  context.after(() => {
    clearTestEmailCapture();
    restoreEnv(saved);
  });

  process.env.EMAIL_PROVIDER = "console";
  process.env.MAIL_FROM = "织幕 <noreply@example.invalid>";
  process.env.APP_PUBLIC_URL = "http://localhost:4173";
  process.env.EMAIL_DELIVERY_STUB = "1";

  const { sendEmailVerificationEmail } = await import("../src/email/index.js");
  await sendEmailVerificationEmail({ to: "user@example.invalid", verifyToken: "abc123token" });
  const url = peekTestVerifyUrl();
  assert.match(url, /^http:\/\/localhost:4173\/\?verify=abc123token$/);
});
