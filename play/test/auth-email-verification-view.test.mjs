import assert from "node:assert/strict";
import test from "node:test";

globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};

const { state } = await import("../src/state.js");
const { renderAuth } = await import("../src/views/auth.js");

test("play renders the aligned six-digit email verification step", (context) => {
  const snapshot = {
    authMode: state.authMode,
    pendingVerificationEmail: state.pendingVerificationEmail,
    pendingVerificationChallenge: state.pendingVerificationChallenge,
    busy: state.busy
  };
  context.after(() => Object.assign(state, snapshot));
  state.authMode = "verify";
  state.pendingVerificationEmail = "player@example.com";
  state.pendingVerificationChallenge = {
    id: "be36d9de-63e8-4c7b-96a3-b13ad19bb0ef",
    maskedEmail: "pl****@example.com"
  };
  state.busy = false;

  const html = renderAuth();
  assert.match(html, /验证你的邮箱/);
  assert.match(html, /pl\*{4}@example\.com/);
  assert.match(html, /autocomplete="one-time-code"/);
  assert.match(html, /验证并进入玩家端/);
  assert.match(html, /重新发送验证码/);
  assert.match(html, /内测邀请码、房间邀请码互不通用/);
});
