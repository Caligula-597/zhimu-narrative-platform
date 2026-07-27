import { sendViaConsole } from "./providers/console.js";
import { sendViaMailgun } from "./providers/mailgun.js";
import { sendViaResend } from "./providers/resend.js";
import { sendViaSendGrid } from "./providers/sendgrid.js";
import { isSmtpConfigured, sendViaSmtp } from "./providers/smtp.js";
import { worldInviteEmailHtml, passwordResetEmailHtml, emailVerificationHtml } from "./templates.js";
import { enterpriseEmails, enterpriseEmailSummary } from "../enterprise-emails.js";
import { isEmailVerificationRequired } from "../email-verification-policy.js";

function isDeliveryStubbed() {
  return process.env.EMAIL_DELIVERY_STUB === "1" || process.env.PASSWORD_RESET_EMAIL_STUB === "1";
}

const testCaptures = {
  passwordResetUrl: null,
  emailVerifyUrl: null,
  emailVerificationCode: null,
  worldInviteUrl: null
};

export function peekTestResetUrl() {
  return testCaptures.passwordResetUrl;
}

export function peekTestVerifyUrl() {
  return testCaptures.emailVerifyUrl;
}

export function peekTestVerificationCode() {
  return testCaptures.emailVerificationCode;
}

export function peekTestInviteUrl() {
  return testCaptures.worldInviteUrl;
}

export function clearTestEmailCapture() {
  testCaptures.passwordResetUrl = null;
  testCaptures.emailVerifyUrl = null;
  testCaptures.emailVerificationCode = null;
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
  const production = (process.env.NODE_ENV ?? "development") === "production";
  if (production && isDeliveryStubbed()) return false;
  const mailFrom = process.env.MAIL_FROM?.trim();
  if (provider === "console") return !production;
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
  if (provider === "smtp") {
    return isSmtpConfigured() && Boolean(publicAppUrl());
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
    requireVerification: isEmailVerificationRequired(),
    publicAppUrl: publicAppUrl() || null,
    addresses: enterpriseEmailSummary()
  };
}

async function dispatchEmail(payload) {
  const provider = getEmailProvider();
  if (isDeliveryStubbed()) {
    return;
  }
  if (provider === "console") return sendViaConsole(payload);
  if (provider === "smtp") return sendViaSmtp(payload);
  if (provider === "sendgrid") return sendViaSendGrid(payload);
  if (provider === "mailgun") return sendViaMailgun(payload);
  return sendViaResend(payload);
}

export async function sendTransactionalEmail({ to, subject, html }) {
  if (!isEmailConfigured()) {
    throw Object.assign(new Error("Email is not configured on the server"), { statusCode: 503, code: "EMAIL_NOT_CONFIGURED" });
  }
  const addresses = enterpriseEmails();
  await dispatchEmail({
    to,
    subject,
    html,
    from: addresses.mailFrom,
    replyTo: addresses.mailReplyTo
  });
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
    html: passwordResetEmailHtml({ resetUrl })
  });
}

export async function sendEmailVerificationEmail({ to, verifyToken, verificationCode }) {
  const verifyUrl = `${publicAppUrl()}/?verify=${encodeURIComponent(verifyToken)}`;
  if (isDeliveryStubbed()) {
    testCaptures.emailVerifyUrl = verifyUrl;
    testCaptures.emailVerificationCode = verificationCode || null;
    return;
  }
  await sendTransactionalEmail({
    to,
    subject: `织幕邮箱验证码：${verificationCode}`,
    html: emailVerificationHtml({ verifyUrl, verificationCode })
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
