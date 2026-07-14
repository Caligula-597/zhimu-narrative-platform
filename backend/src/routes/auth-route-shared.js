import { query } from "../db.js";
import { createEmailVerificationToken } from "../auth.js";
import { attachSessionToReply } from "../session-cookie.js";
import { sendEmailVerificationEmail } from "../email.js";

export const authBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["email", "password"],
  properties: {
    email: { type: "string", minLength: 3, maxLength: 320 },
    password: { type: "string", minLength: 8, maxLength: 128 }
  }
};

export const forgotPasswordSchema = {
  type: "object",
  additionalProperties: false,
  required: ["email"],
  properties: { email: { type: "string", minLength: 3, maxLength: 320 } }
};

export const resetPasswordSchema = {
  type: "object",
  additionalProperties: false,
  required: ["token", "password"],
  properties: {
    token: { type: "string", minLength: 16, maxLength: 128 },
    password: { type: "string", minLength: 8, maxLength: 128 }
  }
};

export const verifyEmailSchema = {
  type: "object",
  additionalProperties: false,
  required: ["token"],
  properties: { token: { type: "string", minLength: 16, maxLength: 128 } }
};

export const PASSWORD_RESET_ACK = {
  ok: true,
  message: "If that email is registered, you will receive a password reset link shortly."
};

export const VERIFICATION_RESEND_ACK = {
  ok: true,
  message: "If your account requires verification, a new email has been sent."
};

export function userAuthPayload(row) {
  const kind = row.user_kind ?? "registered";
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    userKind: kind,
    isGuest: kind === "guest",
    emailVerified: Boolean(row.email_verified_at)
  };
}

export async function ensureStorageQuota(userId) {
  await query(
    `INSERT INTO storage_quotas (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = storage_quotas.updated_at`,
    [userId]
  );
}

export async function sendVerificationForUser(userId, email) {
  const { token } = await createEmailVerificationToken(userId);
  await sendEmailVerificationEmail({ to: email, verifyToken: token });
}

export function sendAuthSession(reply, session, payload, statusCode) {
  attachSessionToReply(reply, session);
  const body = { ...payload, ...session };
  return statusCode ? reply.code(statusCode).send(body) : body;
}
