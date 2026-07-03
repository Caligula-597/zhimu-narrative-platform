/**
 * Shared api-fetch tests.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createApiFetch, extractAuthToken, createIdempotencyKey } from "../shared/api-fetch.js";

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

test("extractAuthToken reads login token", () => {
  assert.equal(extractAuthToken("/auth/login", { token: "abc" }), "abc");
  assert.equal(extractAuthToken("/worlds", { token: "abc" }), undefined);
});

test("createIdempotencyKey returns string", () => {
  assert.ok(createIdempotencyKey().length > 8);
});
