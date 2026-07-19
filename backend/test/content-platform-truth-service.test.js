import assert from "node:assert/strict";
import test from "node:test";
import { normalizeContentPlatformTruthError } from "../src/content-platform-truth-service.js";

test("truth claim database failures become typed retryable errors", () => {
  const conflict = normalizeContentPlatformTruthError({ code: "23505" });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.code, "TRUTH_CLAIM_KEY_CONFLICT");

  for (const code of ["40P01", "55P03"]) {
    const busy = normalizeContentPlatformTruthError({ code });
    assert.equal(busy.statusCode, 409);
    assert.equal(busy.code, "CONTENT_PLATFORM_WRITE_BUSY");
  }

  const timeout = normalizeContentPlatformTruthError({ code: "57014" });
  assert.equal(timeout.statusCode, 503);
  assert.equal(timeout.code, "CONTENT_PLATFORM_WRITE_TIMEOUT");
});

test("unrelated truth claim errors retain their original identity", () => {
  const original = Object.assign(new Error("unchanged"), { code: "TRUTH_CLAIM_NOT_FOUND" });
  assert.equal(normalizeContentPlatformTruthError(original), original);
});
