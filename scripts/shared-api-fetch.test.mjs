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
    assert.equal(capturedHeaders["X-Request-Id"], capturedHeaders["X-Trace-Id"]);
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

test("extractAuthToken reads login token", () => {
  assert.equal(extractAuthToken("/auth/login", { token: "abc" }), "abc");
  assert.equal(extractAuthToken("/worlds", { token: "abc" }), undefined);
});

test("createIdempotencyKey returns string", () => {
  assert.ok(createIdempotencyKey().length > 8);
});
