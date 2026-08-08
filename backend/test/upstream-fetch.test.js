import assert from "node:assert/strict";
import test from "node:test";
import {
  createUpstreamSignal,
  fetchUpstream,
  resolveUpstreamTimeoutMs
} from "../src/upstream-fetch.js";

test("upstream timeout values are bounded", () => {
  assert.equal(resolveUpstreamTimeoutMs(undefined), 15_000);
  assert.equal(resolveUpstreamTimeoutMs("2500"), 2500);
  assert.equal(resolveUpstreamTimeoutMs("0"), 15_000);
  assert.equal(resolveUpstreamTimeoutMs("999999999"), 15_000);
});

test("fetchUpstream aborts a stalled upstream with a 504 contract", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  });
  try {
    await assert.rejects(
      () => fetchUpstream("https://upstream.invalid", {}, { timeoutMs: 100 }),
      (error) => error.code === "GATEWAY_TIMEOUT" && error.statusCode === 504
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("external cancellation remains distinguishable from an upstream timeout", async () => {
  const controller = new AbortController();
  controller.abort(new Error("caller cancelled"));
  assert.equal(createUpstreamSignal(1000, controller.signal), controller.signal);
});

test("credentialed upstream requests never follow redirects", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (_url, init) => {
    captured = init;
    return new Response(null, { status: 302, headers: { location: "https://redirect.invalid" } });
  };
  try {
    const response = await fetchUpstream(
      "https://provider.invalid",
      { redirect: "follow", headers: { authorization: "Bearer secret" } },
      { timeoutMs: 1000 }
    );
    assert.equal(response.status, 302);
    assert.equal(captured.redirect, "manual");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
