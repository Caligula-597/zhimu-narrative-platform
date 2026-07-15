import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  resolveHttpRequestTimeoutMs,
  resolveTrustProxy,
  safeCorrelationId
} from "../src/app.js";
import { buildFastifyLoggerOptions } from "../src/logger-config.js";
import { resolveFileWithinRoot } from "../src/static-frontend.js";

test("production request logs strip sensitive query strings", () => {
  const options = buildFastifyLoggerOptions({ nodeEnv: "production", loggerOption: true });
  const serialized = options.serializers.req({
    method: "GET",
    url: "/api/auth/oauth/google/callback?code=secret&state=one-time",
    id: "request-1"
  });
  assert.equal(serialized.url, "/api/auth/oauth/google/callback");
  assert.doesNotMatch(JSON.stringify(serialized), /secret|one-time/);
});

test("static path resolution rejects encoded and Windows-style traversal", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhimu-static-root-"));
  try {
    assert.equal(resolveFileWithinRoot(root, "errors/404.html"), path.join(root, "errors", "404.html"));
    assert.equal(resolveFileWithinRoot(root, "../outside.txt"), null);
    assert.equal(resolveFileWithinRoot(root, "%2e%2e%2foutside.txt"), null);
    assert.equal(resolveFileWithinRoot(root, "..\\outside.txt"), null);
    assert.equal(resolveFileWithinRoot(root, "%E0%A4%A"), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("proxy, timeout and correlation settings fail closed", () => {
  assert.equal(resolveTrustProxy(undefined), false);
  assert.equal(resolveTrustProxy("1"), 1);
  assert.equal(resolveTrustProxy("99"), false);
  assert.equal(resolveHttpRequestTimeoutMs("30000"), 30_000);
  assert.equal(resolveHttpRequestTimeoutMs("0"), 120_000);
  assert.equal(safeCorrelationId("trace-123"), "trace-123");
  assert.equal(safeCorrelationId("bad id with spaces"), null);
  assert.equal(safeCorrelationId("x".repeat(129)), null);
});
