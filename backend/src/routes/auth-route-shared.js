import { attachSessionToReply, sessionResponsePayload } from "../session-cookie.js";

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

export const verifyEmailCodeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["challengeId", "code"],
  properties: {
    challengeId: { type: "string", format: "uuid" },
    code: { type: "string", pattern: "^\\d{6}$" }
  }
};

export const resendEmailVerificationCodeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    challengeId: { type: "string", format: "uuid" }
  }
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

export function sendAuthSession(reply, session, payload, statusCode) {
  const nodeEnv = reply.server?.zhimuNodeEnv;
  attachSessionToReply(reply, session, nodeEnv);
  const body = { ...payload, ...sessionResponsePayload(session, nodeEnv) };
  return statusCode ? reply.code(statusCode).send(body) : body;
}
