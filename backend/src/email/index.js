import { sendViaConsole } from "./providers/console.js";
import { sendViaMailgun } from "./providers/mailgun.js";
import { sendViaResend } from "./providers/resend.js";
import { sendViaSendGrid } from "./providers/sendgrid.js";
import { worldInviteEmailHtml } from "./templates.js";

function isDeliveryStubbed() {
  return process.env.EMAIL_DELIVERY_STUB === "1" || process.env.PASSWORD_RESET_EMAIL_STUB === "1";
}

const testCaptures = {
  passwordResetUrl: null,
  emailVerifyUrl: null,
  worldInviteUrl: null
};

export function peekTestResetUrl() {
  return testCaptures.passwordResetUrl;
}

export function peekTestVerifyUrl() {
  return testCaptures.emailVerifyUrl;
}

export function peekTestInviteUrl() {
  return testCaptures.worldInviteUrl;
}

export function clearTestEmailCapture() {
  testCaptures.passwordResetUrl = null;
  testCaptures.emailVerifyUrl = null;
  testCaptures.worldInviteUrl = null;
}

/** @deprecated use clearTestEmailCapture */
export function clearTestResetCapture() {
  clearTestEmailCapture();
}

export function getEmailProvider() {
  return (process.env.EMAIL_PROVIDER || "resend").trim().toLowerCase();
}

export function publicAppUrl() {
  return (process.env.APP_PUBLIC_URL || "").trim().replace(/\/$/, "");
}

export function isEmailConfigured() {
  const provider = getEmailProvider();
  const mailFrom = process.env.MAIL_FROM?.trim();
  if (provider === "console") return true;
  if (!mailFrom) return false;
  if (provider === "resend") {
    return Boolean(process.env.RESEND_API_KEY?.trim() && publicAppUrl());
  }
  if (provider === "sendgrid") {
    return Boolean(process.env.SENDGRID_API_KEY?.trim());
  }
  if (provider === "mailgun") {
    return Boolean(process.env.MAILGUN_API_KEY?.trim() && process.env.MAILGUN_DOMAIN?.trim());
  }
  return false;
}

/** @deprecated */
export function isResendConfigured() {
  return isEmailConfigured() && (getEmailProvider() === "resend" || Boolean(process.env.RESEND_API_KEY?.trim()));
}

export function getEmailServiceStatus() {
  const provider = getEmailProvider();
  return {
    provider,
    configured: isEmailConfigured(),
    requireVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
    publicAppUrl: publicAppUrl() || null
  };
}

async function dispatchEmail(payload) {
  const provider = getEmailProvider();
  if (isDeliveryStubbed()) {
    return;
  }
  if (provider === "console") return sendViaConsole(payload);
  if (provider === "sendgrid") return sendViaSendGrid(payload);
  if (provider === "mailgun") return sendViaMailgun(payload);
  return sendViaResend(payload);
}

export async function sendTransactionalEmail({ to, subject, html }) {
  if (!isEmailConfigured()) {
    throw Object.assign(new Error("Email is not configured on the server"), { statusCode: 503, code: "EMAIL_NOT_CONFIGURED" });
  }
  await dispatchEmail({ to, subject, html });
}

export async function sendPasswordResetEmail({ to, resetToken }) {
  const resetUrl = `${publicAppUrl()}/?reset=${encodeURIComponent(resetToken)}`;
  if (isDeliveryStubbed()) {
    testCaptures.passwordResetUrl = resetUrl;
    return;
  }
  await sendTransactionalEmail({
    to,
    subject: "重置织幕账号密码",
    html: `<p>你好，</p>
<p>我们收到了重置织幕账号密码的请求。请点击下方链接设置新密码（链接 1 小时内有效）：</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>若你没有发起此请求，可忽略本邮件，账号密码不会变更。</p>
<p>— 织幕</p>`
  });
}

export async function sendEmailVerificationEmail({ to, verifyToken }) {
  const verifyUrl = `${publicAppUrl()}/?verify=${encodeURIComponent(verifyToken)}`;
  if (isDeliveryStubbed()) {
    testCaptures.emailVerifyUrl = verifyUrl;
    return;
  }
  await sendTransactionalEmail({
    to,
    subject: "验证织幕账号邮箱",
    html: `<p>你好，</p>
<p>欢迎注册织幕。请点击下方链接验证邮箱（链接 24 小时内有效）：</p>
<p><a href="${verifyUrl}">${verifyUrl}</a></p>
<p>若你没有注册织幕账号，可忽略本邮件。</p>
<p>— 织幕</p>`
  });
}

export async function sendWorldMemberInviteEmail({ to, inviteToken, worldName, inviterName, roleLabel }) {
  const inviteUrl = `${publicAppUrl()}/?invite=${encodeURIComponent(inviteToken)}`;
  if (isDeliveryStubbed()) {
    testCaptures.worldInviteUrl = inviteUrl;
    return;
  }
  await sendTransactionalEmail({
    to,
    subject: `织幕协作邀请 · ${worldName}`,
    html: worldInviteEmailHtml({ inviterName, worldName, roleLabel, inviteUrl })
  });
}
