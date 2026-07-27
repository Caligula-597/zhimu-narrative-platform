import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createEmailVerificationChallenge,
  createEmailVerificationCode,
  emailVerificationCodeMatches,
  hasEmailVerificationCodeSecret,
  maskEmail,
  publicEmailVerificationChallenge
} from "../src/email-verification-code.js";

test("email verification codes are always six numeric digits", () => {
  for (let index = 0; index < 200; index += 1) {
    assert.match(createEmailVerificationCode(), /^\d{6}$/);
  }
});

test("production code secret requires at least 32 bytes", () => {
  assert.equal(hasEmailVerificationCodeSecret({ EMAIL_VERIFICATION_CODE_SECRET: "short" }), false);
  assert.equal(
    hasEmailVerificationCodeSecret({ EMAIL_VERIFICATION_CODE_SECRET: "x".repeat(32) }),
    true
  );
});

test("verification code hashes are challenge-bound and safely comparable", () => {
  const first = createEmailVerificationChallenge(1_000);
  const second = createEmailVerificationChallenge(1_000);
  assert.equal(
    emailVerificationCodeMatches(first.challengeId, first.code, first.codeHash),
    true
  );
  assert.equal(
    emailVerificationCodeMatches(second.challengeId, first.code, first.codeHash),
    false
  );
  assert.equal(
    emailVerificationCodeMatches(first.challengeId, "000000", first.codeHash),
    first.code === "000000"
  );
});

test("public verification challenge masks email and never exposes credentials", () => {
  const challenge = createEmailVerificationChallenge(10_000);
  const payload = publicEmailVerificationChallenge(challenge, "owner@getzhimu.com", 10_000);
  assert.equal(payload.id, challenge.challengeId);
  assert.equal(payload.maskedEmail, "ow***@getzhimu.com");
  assert.equal(payload.codeLength, 6);
  assert.equal(payload.expiresInSeconds, 600);
  assert.equal(payload.resendAfterSeconds, 60);
  assert.equal("code" in payload, false);
  assert.equal("token" in payload, false);
  assert.equal(maskEmail("a@example.com"), "a**@example.com");
});

test("email verification migration adds challenge, expiry, attempt, and cooldown state", async () => {
  const sql = await readFile(
    new URL("../migrations/102_email_verification_codes.sql", import.meta.url),
    "utf8"
  );
  for (const column of [
    "challenge_id",
    "verification_code_hash",
    "verification_code_expires_at",
    "failed_attempts",
    "last_sent_at"
  ]) {
    assert.match(sql, new RegExp(`\\b${column}\\b`, "i"));
  }
  assert.match(sql, /CREATE UNIQUE INDEX[\s\S]*challenge_id/i);
  assert.match(sql, /CHECK\s*\(\s*failed_attempts\s*>=\s*0\s*\)/i);
});
