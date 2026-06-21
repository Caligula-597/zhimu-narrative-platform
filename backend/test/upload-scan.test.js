import assert from "node:assert/strict";
import test from "node:test";
import { resolveScanMode, scanUploadedObject } from "../src/upload-scan.js";

test("resolveScanMode defaults to builtin in production", () => {
  assert.equal(resolveScanMode({ NODE_ENV: "production" }), "builtin");
  assert.equal(resolveScanMode({ NODE_ENV: "development" }), "none");
  assert.equal(resolveScanMode({ NODE_ENV: "production", UPLOAD_SCAN_MODE: "none" }), "none");
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
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ clean: false })
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
