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

test("platform SSE transport drops events with invalid contract payloads", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  context.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.fetch = async () => new Response(
    [
      'data: {"type":"plaza.post_created","at":"now"}\n\n',
      'data: {"type":"plaza.post_created","postId":"post-1","at":"now"}\n\n'
    ].join(""),
    { status: 200, headers: { "content-type": "text/event-stream" } }
  );
  const events = [];
  const client = createPortalApiClient({ baseUrl: "http://test/api" });

  await client.streamPlatformEvents({
    onEvent: async (type, payload) => events.push({ type, payload })
  });

  assert.deepEqual(events, [
    { type: "plaza.post_created", payload: { postId: "post-1" } }
  ]);
});

test("a late 401 cannot clear a newer bearer token", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let release;
  let token = "old";
  const clears = [];
  globalThis.fetch = async () => new Promise((resolve) => { release = resolve; });
  const client = createPortalApiClient({
    baseUrl: "http://test/api",
    tokenStore: {
      bearerHeaders: () => token ? { authorization: `Bearer ${token}` } : {},
      set(value) { token = value; },
      clear(source) { clears.push(source); token = ""; }
    },
    clearTokenOn401: true
  });

  const oldRequest = client.request("/auth/me");
  await Promise.resolve();
  token = "new";
  release(new Response(JSON.stringify({ error: "expired" }), {
    status: 401,
    headers: { "content-type": "application/json" }
  }));
  await assert.rejects(oldRequest, (error) => error.staleCredential === true && !error.sessionRejected);
  assert.equal(token, "new");
  assert.deepEqual(clears, []);
});

test("a late SSE handshake 401 is marked stale for safe reconnect", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let release;
  let token = "old";
  let clears = 0;
  globalThis.fetch = async () => new Promise((resolve) => { release = resolve; });
  const client = createPortalApiClient({
    baseUrl: "http://test/api",
    tokenStore: {
      bearerHeaders: () => token ? { authorization: `Bearer ${token}` } : {},
      set(value) { token = value; },
      clear() { clears += 1; token = ""; }
    },
    clearTokenOn401: true
  });

  const oldStream = client.streamPlatformEvents({ onEvent() {} });
  await Promise.resolve();
  token = "new";
  release(new Response(JSON.stringify({ error: "expired" }), {
    status: 401,
    headers: { "content-type": "application/json" }
  }));
  await assert.rejects(oldStream, (error) => error.status === 401 && error.staleCredential === true);
  assert.equal(token, "new");
  assert.equal(clears, 0);
});

test("a current protected-route 401 clears once, but a failed login does not", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" }
  });
  let token = "current";
  const clears = [];
  const client = createPortalApiClient({
    baseUrl: "http://test/api",
    tokenStore: {
      bearerHeaders: () => token ? { authorization: `Bearer ${token}` } : {},
      set(value) { token = value; },
      clear(source) { clears.push(source); token = ""; }
    },
    clearTokenOn401: true
  });

  const protectedResults = await Promise.allSettled([client.request("/worlds"), client.request("/platform/site")]);
  assert.deepEqual(clears, ["rejected"]);
  assert.equal(protectedResults.some((result) => result.status === "rejected" && result.reason.sessionRejected), true);
  token = "still-signed-in";
  await assert.rejects(
    client.request("/auth/login", { method: "POST", body: {} }),
    (error) => !error.sessionRejected
  );
  assert.equal(token, "still-signed-in");
  assert.deepEqual(clears, ["rejected"]);
});
