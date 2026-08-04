import test from "node:test";
import assert from "node:assert/strict";

import { state } from "../src/state.js";
import { renderAuth } from "../src/views/auth.js";

function snapshotAuthState() {
  return {
    authMode: state.authMode,
    authConfig: state.authConfig,
    pendingVerificationEmail: state.pendingVerificationEmail,
    pendingVerificationChallenge: state.pendingVerificationChallenge,
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
  assert.match(html, /注册后会收到 6 位邮箱验证码/);
  assert.match(html, /注册并发送验证码/);
});

test("host renders a dedicated pending verification state", (context) => {
  const snapshot = snapshotAuthState();
  context.after(() => restoreAuthState(snapshot));

  state.pendingVerificationEmail = "reader@example.com";
  state.pendingVerificationChallenge = {
    id: "be36d9de-63e8-4c7b-96a3-b13ad19bb0ef",
    maskedEmail: "re****@example.com"
  };
  state.canResendVerification = true;

  const html = renderAuth();
  assert.match(html, /验证你的邮箱/);
  assert.match(html, /re\*{4}@example\.com/);
  assert.match(html, /autocomplete="one-time-code"/);
  assert.match(html, /验证并进入主持端/);
  assert.match(html, /data-action="resend-verification-code"/);
  assert.match(html, /data-action="verification-back-login"/);
});

test("host keeps the code action disabled when no challenge is available", (context) => {
  const snapshot = snapshotAuthState();
  context.after(() => restoreAuthState(snapshot));

  state.pendingVerificationEmail = "reader@example.com";
  state.pendingVerificationChallenge = null;
  state.canResendVerification = false;

  const html = renderAuth();
  assert.match(html, /data-action="resend-verification-code"/);
  assert.match(html, /验证并进入主持端<\/button>/);
  assert.match(html, /验证并进入主持端/);
  assert.match(html, /disabled/);
});
