/**
 * AES-256-GCM for user-supplied API keys at rest.
 * Requires LLM_CREDENTIALS_SECRET (or OPS_API_TOKEN fallback) in production.
 */
import crypto from "node:crypto";

const PREFIX = "zhimu1:";

function deriveKey() {
  const secret = process.env.LLM_CREDENTIALS_SECRET?.trim() || process.env.OPS_API_TOKEN?.trim();
  if (!secret) return null;
  return crypto.createHash("sha256").update(`${PREFIX}key:${secret}`).digest();
}

export function canEncryptSecrets() {
  return Boolean(deriveKey());
}

export function encryptSecret(plaintext) {
  const key = deriveKey();
  if (!key) {
    const error = new Error("LLM credential encryption is not configured");
    error.code = "LLM_CREDENTIALS_NOT_CONFIGURED";
    error.statusCode = 503;
    throw error;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload) {
  if (!payload || !String(payload).startsWith(PREFIX)) {
    const error = new Error("Invalid encrypted secret");
    error.code = "INTERNAL_ERROR";
    error.statusCode = 500;
    throw error;
  }
  const key = deriveKey();
  if (!key) {
    const error = new Error("LLM credential encryption is not configured");
    error.code = "LLM_CREDENTIALS_NOT_CONFIGURED";
    error.statusCode = 503;
    throw error;
  }
  const body = String(payload).slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = body.split(".");
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function maskApiKeyHint(apiKey) {
  const text = String(apiKey || "").trim();
  if (text.length <= 4) return "****";
  return `…${text.slice(-4)}`;
}
