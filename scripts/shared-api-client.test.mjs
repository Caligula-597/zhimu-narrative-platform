import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBearerAuthHeaders,
  createPortalApiClient,
  createPortalJsonError,
  resolveDemoUserId,
  resolveVitePortalApiBase
} from "../shared/api-client.js";

test("resolveVitePortalApiBase uses relative path in dev", () => {
  assert.equal(resolveVitePortalApiBase({ dev: true }), "/api");
});

test("resolveVitePortalApiBase uses app origin in prod", () => {
  assert.equal(
    resolveVitePortalApiBase({ viteAppOrigin: "https://app.example.com", dev: false }),
    "https://app.example.com/api"
  );
});

test("resolveDemoUserId respects demo flag when required", () => {
  const storage = new Map([["zhimuDemoMode", "true"], ["zhimuDemoUserId", "u1"]]);
  const ls = { getItem: (k) => storage.get(k) ?? null };
  assert.equal(resolveDemoUserId(ls, { requireDemoFlag: true }), "u1");
  storage.set("zhimuDemoMode", "false");
  assert.equal(resolveDemoUserId(ls, { requireDemoFlag: true }), null);
});

test("createPortalApiClient wires bearer + demo headers", async () => {
  const original = globalThis.fetch;
  let capturedHeaders;
  globalThis.localStorage = {
    getItem: (key) => (key === "zhimuDemoUserId" ? "demo-1" : null)
  };
  globalThis.fetch = async (_url, init) => {
    capturedHeaders = init.headers;
    return { ok: true, json: async () => ({ ok: true }) };
  };
  try {
    const tokenStore = {
      bearerHeaders: () => ({ authorization: "Bearer t" }),
      set() {}
    };
    const { request } = createPortalApiClient({
      baseUrl: "http://test/api",
      tokenStore,
      getDemoUserId: () => "demo-1"
    });
    await request("/auth/me");
    assert.equal(capturedHeaders.authorization, "Bearer t");
    assert.equal(capturedHeaders["x-user-id"], "demo-1");
    assert.ok(capturedHeaders["X-Trace-Id"]);
  } finally {
    globalThis.fetch = original;
    delete globalThis.localStorage;
  }
});

test("createPortalJsonError preserves code and status", () => {
  const err = createPortalJsonError({ status: 403 }, { error: "nope", code: "FORBIDDEN" });
  assert.equal(err.code, "FORBIDDEN");
  assert.equal(err.status, 403);
});

test("buildBearerAuthHeaders merges demo user id", () => {
  const headers = buildBearerAuthHeaders({ bearerHeaders: () => ({ authorization: "Bearer x" }) }, { demoUserId: "u" });
  assert.equal(headers["x-user-id"], "u");
});
