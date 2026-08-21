import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createPortalApiClient } from "../shared/api-client.js";
import { createSessionController } from "../play/src/runtime/session-controller.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Player coalesces concurrent guest-session creation", async () => {
  let token = "";
  let guestCalls = 0;
  const state = { user: null };
  const controller = createSessionController({
    api: {
      me: async () => null,
      guest: async () => {
        guestCalls += 1;
        await Promise.resolve();
        return { token: "guest-token", user: { id: "guest-1", displayName: "Guest" } };
      }
    },
    state,
    clearSession: () => { token = ""; },
    getSessionToken: () => token,
    setSessionToken: (value) => { token = value; }
  });

  await Promise.all([controller.ensureSession(), controller.ensureSession(), controller.ensureSession()]);
  assert.equal(guestCalls, 1);
  assert.equal(token, "guest-token");
  assert.equal(state.user.id, "guest-1");
});

test("Player ignores an old profile response after another tab changes token", async () => {
  let token = "old-token";
  let releaseOld;
  let calls = 0;
  const state = { user: { id: "known-user" } };
  const controller = createSessionController({
    api: {
      guest: async () => null,
      me: async () => {
        calls += 1;
        if (calls === 1) return new Promise((resolve) => { releaseOld = resolve; });
        return { id: "new-user", displayName: "New" };
      }
    },
    state,
    clearSession: () => { token = ""; },
    getSessionToken: () => token,
    setSessionToken: (value) => { token = value; }
  });

  const oldProbe = controller.loadSessionUser();
  token = "new-token";
  const newProbe = controller.loadSessionUser();
  releaseOld({ id: "old-user", displayName: "Old" });
  await Promise.all([oldProbe, newProbe]);
  assert.equal(calls, 2);
  assert.equal(state.user.id, "new-user");
});

test("concurrent HTTP 401 responses invalidate a portal token once", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "expired" }), {
    status: 401,
    headers: { "content-type": "application/json" }
  });
  let clears = 0;
  let token = "expired";
  const client = createPortalApiClient({
    baseUrl: "http://test/api",
    tokenStore: {
      bearerHeaders: () => token ? { authorization: `Bearer ${token}` } : {},
      set(value) { token = value; },
      clear() { clears += 1; token = ""; }
    },
    clearTokenOn401: true
  });

  await Promise.allSettled([
    client.request("/auth/me"),
    client.request("/worlds"),
    client.request("/platform/site")
  ]);
  assert.equal(clears, 1);
});

test("all three portals subscribe to cross-tab auth changes", () => {
  const creator = fs.readFileSync(path.join(root, "src/runtime/session-auth.js"), "utf8");
  const host = fs.readFileSync(path.join(root, "host/src/main.js"), "utf8");
  const player = fs.readFileSync(path.join(root, "play/src/main.js"), "utf8");
  const playerRuntimeEdges = fs.readFileSync(path.join(root, "play/src/runtime/runtime-edge-bindings.js"), "utf8");
  const playerApi = fs.readFileSync(path.join(root, "play/src/api.js"), "utf8");
  const hostLifecycle = fs.readFileSync(path.join(root, "host/src/runtime/host-lifecycle-controller.js"), "utf8");
  assert.match(creator, /addEventListener\?\.\("storage"/);
  assert.match(host, /subscribeSessionToken/);
  assert.match(player, /subscribeSessionToken/);
  assert.match(playerApi, /clearTokenOn401:\s*true/);
  assert.match(host, /change\.source === "storage" \|\| change\.source === "rejected"/);
  assert.match(playerRuntimeEdges, /change\.source !== "storage" && change\.source !== "rejected"/);
  assert.doesNotMatch(hostLifecycle, /error\.status === 401\) state\.user = null/);
});

test("auth failure matrix documentation keeps every release scenario", () => {
  const doc = fs.readFileSync(path.join(root, "docs/AUTH_FAILURE_MATRIX_ZH.md"), "utf8");
  for (let index = 1; index <= 12; index += 1) {
    assert.match(doc, new RegExp(`AUTH-${String(index).padStart(2, "0")}`));
  }
});
