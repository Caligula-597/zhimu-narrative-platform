import assert from "node:assert/strict";
import test from "node:test";
import { resolveScanMode, resolveUploadScanLimits, scanUploadedObject } from "../src/upload-scan.js";

test("resolveScanMode defaults to builtin in production", () => {
  assert.equal(resolveScanMode({ NODE_ENV: "production" }), "builtin");
  assert.equal(resolveScanMode({ NODE_ENV: "development" }), "none");
  assert.equal(resolveScanMode({ NODE_ENV: "production", UPLOAD_SCAN_MODE: "none" }), "none");
});

test("upload scan byte limits reject unsafe environment overrides", () => {
  assert.deepEqual(resolveUploadScanLimits({
    UPLOAD_SCAN_HEAD_BYTES: "-1",
    UPLOAD_SCAN_CLAMAV_MAX_BYTES: "Infinity"
  }), {
    headBytes: 65_536,
    clamAvMaxBytes: 35 * 1024 * 1024
  });
  assert.deepEqual(resolveUploadScanLimits({
    UPLOAD_SCAN_HEAD_BYTES: "131072",
    UPLOAD_SCAN_CLAMAV_MAX_BYTES: String(50 * 1024 * 1024)
  }), {
    headBytes: 131_072,
    clamAvMaxBytes: 50 * 1024 * 1024
  });
});

test("scanUploadedObject skips when none", async () => {
  const previous = process.env.UPLOAD_SCAN_MODE;
  process.env.UPLOAD_SCAN_MODE = "none";
  try {
    const result = await scanUploadedObject({
      key: "uploads/test.png",
      contentType: "image/png",
      byteSize: 100
    });
    assert.equal(result.skipped, true);
    assert.equal(result.clean, true);
  } finally {
    if (previous === undefined) delete process.env.UPLOAD_SCAN_MODE;
    else process.env.UPLOAD_SCAN_MODE = previous;
  }
});

test("scanUploadedObject stub mode supports clean and infected", async () => {
  const previousMode = process.env.UPLOAD_SCAN_MODE;
  const previousStub = process.env.UPLOAD_SCAN_STUB_RESULT;
  process.env.UPLOAD_SCAN_MODE = "stub";
  try {
    process.env.UPLOAD_SCAN_STUB_RESULT = "clean";
    const clean = await scanUploadedObject({ key: "k", contentType: "image/png", byteSize: 1 });
    assert.equal(clean.mode, "stub");

    process.env.UPLOAD_SCAN_STUB_RESULT = "infected";
    await assert.rejects(
      () => scanUploadedObject({ key: "k", contentType: "image/png", byteSize: 1 }),
      (err) => err.code === "UPLOAD_SCAN_INFECTED"
    );
  } finally {
    if (previousMode === undefined) delete process.env.UPLOAD_SCAN_MODE;
    else process.env.UPLOAD_SCAN_MODE = previousMode;
    if (previousStub === undefined) delete process.env.UPLOAD_SCAN_STUB_RESULT;
    else process.env.UPLOAD_SCAN_STUB_RESULT = previousStub;
  }
});

test("scanUploadedObject rejects infected webhook response", async () => {
  const previousMode = process.env.UPLOAD_SCAN_MODE;
  const previousUrl = process.env.UPLOAD_SCAN_WEBHOOK_URL;
  process.env.UPLOAD_SCAN_MODE = "webhook";
  process.env.UPLOAD_SCAN_WEBHOOK_URL = "http://scan.test/check";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ clean: false }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });

  try {
    await assert.rejects(
      () => scanUploadedObject({ key: "k", contentType: "image/png", byteSize: 1 }),
      (err) => err.code === "UPLOAD_SCAN_INFECTED"
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previousMode === undefined) delete process.env.UPLOAD_SCAN_MODE;
    else process.env.UPLOAD_SCAN_MODE = previousMode;
    if (previousUrl === undefined) delete process.env.UPLOAD_SCAN_WEBHOOK_URL;
    else process.env.UPLOAD_SCAN_WEBHOOK_URL = previousUrl;
  }
});

test("scanUploadedObject fails closed on malformed or missing webhook verdicts", async () => {
  const previousMode = process.env.UPLOAD_SCAN_MODE;
  const previousUrl = process.env.UPLOAD_SCAN_WEBHOOK_URL;
  process.env.UPLOAD_SCAN_MODE = "webhook";
  process.env.UPLOAD_SCAN_WEBHOOK_URL = "http://scan.test/check";
  const originalFetch = globalThis.fetch;

  try {
    for (const body of ["not-json", JSON.stringify({ status: "ok" })]) {
      globalThis.fetch = async () => new Response(body, { status: 200 });
      await assert.rejects(
        () => scanUploadedObject({ key: "k", contentType: "image/png", byteSize: 1 }),
        (error) => error.code === "UPLOAD_SCAN_FAILED"
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (previousMode === undefined) delete process.env.UPLOAD_SCAN_MODE;
    else process.env.UPLOAD_SCAN_MODE = previousMode;
    if (previousUrl === undefined) delete process.env.UPLOAD_SCAN_WEBHOOK_URL;
    else process.env.UPLOAD_SCAN_WEBHOOK_URL = previousUrl;
  }
});
