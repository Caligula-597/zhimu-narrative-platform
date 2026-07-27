import test from "node:test";
import assert from "node:assert/strict";

import { state } from "../src/state.js";
import { renderAuth } from "../src/views/auth.js";

function snapshotAuthState() {
  return {
    authMode: state.authMode,
    authConfig: state.authConfig,
    pendingVerificationEmail: state.pendingVerificationEmail,
    canResendVerification: state.canResendVerification,
    busy: state.busy
  };
}

function restoreAuthState(snapshot) {
  Object.assign(state, snapshot);
}

test("host registration explains the email verification step", (context) => {
  const snapshot = snapshotAuthState();
  context.after(() => restoreAuthState(snapshot));

  state.authMode = "register";
  state.authConfig = { requireEmailVerification: true, oauth: [] };
  state.pendingVerificationEmail = "";
  state.canResendVerification = false;

  const html = renderAuth();
  assert.match(html, /注册后会收到织幕企业邮箱发送的验证邮件/);
  assert.match(html, /注册并发送验证邮件/);
});

test("host renders a dedicated pending verification state", (context) => {
  const snapshot = snapshotAuthState();
  context.after(() => restoreAuthState(snapshot));

  state.pendingVerificationEmail = "reader@example.com";
  state.canResendVerification = true;

  const html = renderAuth();
  assert.match(html, /请查收验证邮件/);
  assert.match(html, /reader@example\.com/);
  assert.match(html, /data-action="resend-verification"/);
  assert.match(html, /data-action="verification-back-login"/);
});

test("host does not offer unauthenticated resend immediately after registration", (context) => {
  const snapshot = snapshotAuthState();
  context.after(() => restoreAuthState(snapshot));

  state.pendingVerificationEmail = "reader@example.com";
  state.canResendVerification = false;

  const html = renderAuth();
  assert.doesNotMatch(html, /data-action="resend-verification"/);
  assert.match(html, /未收到时可重发/);
});
