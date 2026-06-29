import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLOWED_OAUTH_PROVIDERS,
  asArray,
  escapeHtml,
  isSafeOAuthRedirectUrl,
  isUuid,
  normalizeInviteCode,
  sanitizeImageUrl
} from "../../shared/security.js";

test("escapeHtml neutralizes HTML injection", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(escapeHtml("a & b"), "a &amp; b");
  assert.equal(escapeHtml("it's fine"), "it&#39;s fine");
});

test("sanitizeImageUrl allows https only", () => {
  assert.equal(sanitizeImageUrl("https://cdn.example.com/a.jpg"), "https://cdn.example.com/a.jpg");
  assert.equal(sanitizeImageUrl("http://cdn.example.com/a.jpg"), "");
  assert.equal(sanitizeImageUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeImageUrl('"><script>'), "");
});

test("isSafeOAuthRedirectUrl blocks open redirects", () => {
  assert.equal(
    isSafeOAuthRedirectUrl("https://accounts.google.com/o/oauth2/v2/auth?client_id=x"),
    true
  );
  assert.equal(
    isSafeOAuthRedirectUrl("https://github.com/login/oauth/authorize?client_id=x"),
    true
  );
  assert.equal(isSafeOAuthRedirectUrl("https://evil.example/phish"), false);
  assert.equal(isSafeOAuthRedirectUrl("http://accounts.google.com/o/oauth2/v2/auth"), false);
});

test("normalizeInviteCode trims and caps length", () => {
  assert.equal(normalizeInviteCode("  ABC123  "), "ABC123");
  assert.equal(normalizeInviteCode("x".repeat(100)).length, 64);
});

test("isUuid validates room ids from storage", () => {
  assert.equal(isUuid("20725d66-35ec-4d2f-aef8-4794cef6ace1"), true);
  assert.equal(isUuid("<script>"), false);
  assert.equal(isUuid(""), false);
});

test("asArray tolerates JSON strings from API", () => {
  assert.deepEqual(asArray([{ id: "1" }]), [{ id: "1" }]);
  assert.deepEqual(asArray('[{"id":"1"}]'), [{ id: "1" }]);
  assert.deepEqual(asArray("not-json"), []);
  assert.deepEqual(asArray(null), []);
});

test("oauth provider allowlist is fixed", () => {
  assert.deepEqual([...ALLOWED_OAUTH_PROVIDERS].sort(), ["github", "google"]);
});
