import test from "node:test";
import assert from "node:assert/strict";

import {
  authProbeFailureStatus,
  isSessionRejection,
  normalizeAuthenticatedUser,
  revokeSessionForLogout,
  shouldInvalidateSessionForUnauthorized
} from "../shared/auth-state.js";

test("auth payload normalization accepts flat and nested users", () => {
  const flat = { id: "user-1", email: "one@example.com" };
  const nested = { user: { id: "user-2", email: "two@example.com" } };
  assert.equal(normalizeAuthenticatedUser(flat), flat);
  assert.equal(normalizeAuthenticatedUser(nested), nested.user);
  assert.equal(normalizeAuthenticatedUser({ user: {} }), null);
});

test("logout accepts an already expired session but preserves other failures", async () => {
  await assert.doesNotReject(() => revokeSessionForLogout(async () => {
    throw Object.assign(new Error("expired"), { status: 401 });
  }));
  await assert.rejects(
    () => revokeSessionForLogout(async () => {
      throw Object.assign(new Error("offline"), { status: 503 });
    }),
    /offline/
  );
});

test("only an explicit 401 invalidates a known session", () => {
  assert.equal(isSessionRejection({ status: 401 }), true);
  assert.equal(authProbeFailureStatus({ status: 401 }), "anonymous");
  assert.equal(authProbeFailureStatus({ status: 500 }), "unavailable");
  assert.equal(authProbeFailureStatus({ code: "NETWORK_ERROR" }), "unavailable");
});

test("credential-attempt 401s do not revoke an existing session", () => {
  for (const path of [
    "/auth/login",
    "/auth/register",
    "/auth/guest",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify-email",
    "https://app.example.com/api/auth/oauth/complete"
  ]) {
    assert.equal(shouldInvalidateSessionForUnauthorized(path), false, path);
  }
  assert.equal(shouldInvalidateSessionForUnauthorized("/auth/me"), true);
  assert.equal(shouldInvalidateSessionForUnauthorized("/worlds"), true);
});
