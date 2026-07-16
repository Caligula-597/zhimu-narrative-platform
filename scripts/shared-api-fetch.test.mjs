/**
 * Shared api-fetch tests.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createApiFetch, extractAuthToken, createIdempotencyKey } from "../shared/api-fetch.js";

test("createApiFetch sends trace headers", async () => {
  const original = globalThis.fetch;
  let capturedHeaders;
  globalThis.sessionStorage = {
    getItem: () => null,
    setItem: () => {}
  };
  globalThis.fetch = async (_url, init) => {
    capturedHeaders = init.headers;
    return { ok: true, json: async () => ({ ok: true }) };
  };
  try {
    const { request } = createApiFetch({ baseUrl: "http://test/api" });
    await request("/ping");
    assert.ok(capturedHeaders["X-Trace-Id"]);
    assert.ok(capturedHeaders["X-Request-Id"]);
    assert.notEqual(capturedHeaders["X-Request-Id"], capturedHeaders["X-Trace-Id"]);
  } finally {
    globalThis.fetch = original;
    delete globalThis.sessionStorage;
  }
});

test("createApiFetch returns JSON on success", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true, id: "1" })
  });
  try {
    const { request } = createApiFetch({ baseUrl: "http://test/api" });
    const data = await request("/ping");
    assert.equal(data.id, "1");
  } finally {
    globalThis.fetch = original;
  }
});

test("createApiFetch rejects a successful HTML fallback", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => "text/html; charset=utf-8" },
    json: async () => { throw new SyntaxError("Unexpected token '<'"); }
  });
  try {
    const { request } = createApiFetch({ baseUrl: "http://test/api" });
    await assert.rejects(
      request("/worlds"),
      (err) => err.code === "INVALID_API_RESPONSE" && err.status === 200
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("createApiFetch accepts an empty 204 success", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 204,
    headers: { get: () => null },
    json: async () => { throw new SyntaxError("empty"); }
  });
  try {
    const { request } = createApiFetch({ baseUrl: "http://test/api" });
    assert.deepEqual(await request("/session", { method: "DELETE" }), {});
  } finally {
    globalThis.fetch = original;
  }
});

test("createApiFetch maps HTTP errors", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ error: "nope", code: "FORBIDDEN" })
  });
  try {
    const { request } = createApiFetch({ baseUrl: "http://test/api" });
    await assert.rejects(request("/secret"), (err) => err.code === "FORBIDDEN" && err.status === 403);
  } finally {
    globalThis.fetch = original;
  }
});

test("createApiFetch preserves custom mapped HTTP status", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: "auth required", code: "AUTH_REQUIRED" })
  });
  try {
    const { request } = createApiFetch({
      baseUrl: "http://test/api",
      mapHttpError(response, payload) {
        const err = new Error(payload.error);
        err.code = payload.code;
        err.status = response.status;
        return err;
      }
    });
    await assert.rejects(request("/me"), (err) => err.code === "AUTH_REQUIRED" && err.status === 401);
  } finally {
    globalThis.fetch = original;
  }
});

test("createApiFetch gives error handlers the request-start snapshot", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: "expired" })
  });
  let version = 7;
  let observed;
  try {
    const { request } = createApiFetch({
      baseUrl: "http://test/api",
      getRequestState: () => ({ version }),
      getHeaders: () => ({ authorization: "Bearer old" }),
      onHttpError(_path, _options, _error, _attempt, meta) {
        observed = meta;
        return null;
      }
    });
    const pending = request("/auth/me");
    version = 8;
    await assert.rejects(pending);
    assert.equal(observed.requestState.version, 7);
    assert.equal(observed.headers.authorization, "Bearer old");
  } finally {
    globalThis.fetch = original;
  }
});

test("extractAuthToken reads login token", () => {
  assert.equal(extractAuthToken("/auth/login", { token: "abc" }), "abc");
  assert.equal(extractAuthToken("/worlds", { token: "abc" }), undefined);
});

test("createIdempotencyKey returns string", () => {
  assert.ok(createIdempotencyKey().length > 8);
});

test("idempotent requests sticky-reuse the same key for identical payload", async () => {
  const seen = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    seen.push(init.headers["idempotency-key"]);
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    };
  };
  try {
    const { request } = createApiFetch({
      baseUrl: "http://example.test",
      getHeaders: () => ({})
    });
    await request("/api/rooms/r1/host/grant-item", {
      method: "POST",
      body: { roleSlotId: "a", itemId: "b", quantity: 1 },
      idempotent: true
    });
    await request("/api/rooms/r1/host/grant-item", {
      method: "POST",
      body: { roleSlotId: "a", itemId: "b", quantity: 1 },
      idempotent: true
    });
    assert.equal(seen.length, 2);
    assert.equal(seen[0], seen[1]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
