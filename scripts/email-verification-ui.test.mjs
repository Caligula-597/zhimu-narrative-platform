import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authWorld = fs.readFileSync(
  new URL("../src/runtime/auth-world.js", import.meta.url),
  "utf8"
);
const creatorApiClient = fs.readFileSync(
  new URL("../src/api/client.js", import.meta.url),
  "utf8"
);

test("login surface exposes a discoverable email-code entry", () => {
  assert.match(authWorld, /data-auth-verify-entry/);
  assert.match(authWorld, /已有验证码？验证邮箱/);
  assert.match(authWorld, /请输入邮件中的 6 位验证码/);
  assert.match(authWorld, /openVerifyPending\(email,Boolean\(result\.verificationChallenge\)/);
});

test("email-link verification is awaited before startup continues", () => {
  assert.match(authWorld, /export async function openVerifyEmail/);
  assert.match(authWorld, /pending\.push\(openVerifyEmail\(verifyToken\)\)/);
  assert.doesNotMatch(authWorld, /pending\.push\(\(async\(\)=>\{await openVerifyEmail/);
  assert.match(authWorld, /sessionStorage\.setItem\("zhimuAuthPrompted","1"\)/);
});

test("pending verification never marks the creator portal authenticated", () => {
  assert.match(
    creatorApiClient,
    /if \(result\?\.pendingEmailVerification\) return result;/
  );
  assert.match(creatorApiClient, /markSessionFromResponse\(payload\)/);
});

test("successful authentication does not present an empty workspace as an outage", () => {
  assert.match(authWorld, /loadCloudData\(false,true\)/);
  assert.doesNotMatch(authWorld, /const finishAuth=.*loadCloudData\(true,true\)/);
  assert.match(authWorld, /工作区暂时未加载，请刷新页面重试/);
});

test("startup query parameters remain before the URL hash", () => {
  assert.match(
    authWorld,
    /`\$\{window\.location\.pathname\}\$\{qs\?`\?\$\{qs\}`:""\}\$\{window\.location\.hash\|\|""\}`/
  );
});
