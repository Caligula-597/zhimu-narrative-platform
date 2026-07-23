import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

export function isEmailVerificationRequired() {
  if ((process.env.NODE_ENV ?? "development") === "production") return true;
  return process.env.REQUIRE_EMAIL_VERIFICATION === "true";
}

export async function isUserEmailVerified(userId) {
  const result = await query(`SELECT email_verified_at FROM users WHERE id = $1`, [userId]);
  return Boolean(result.rows[0]?.email_verified_at);
}

export async function markUserEmailVerified(userId) {
  await query(
    `UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1`,
    [userId]
  );
}

export async function requireVerifiedEmail(userId) {
  if (!isEmailVerificationRequired()) return;
  if (!(await isUserEmailVerified(userId))) {
    throwErr("EMAIL_NOT_VERIFIED");
  }
}
