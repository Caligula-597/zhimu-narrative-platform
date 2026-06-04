import assert from "node:assert/strict";
import test from "node:test";
import { validateFilename, validateUpload } from "../src/asset-policy.js";

test("validateFilename rejects path traversal and blocked extensions", () => {
  assert.throws(() => validateFilename("../evil.png"), /Invalid filename/);
  assert.throws(() => validateFilename("payload.exe"), /extension not allowed/);
  assert.throws(() => validateFilename("x.svg"), /extension not allowed/);
  assert.equal(validateFilename("cover.webp"), "cover.webp");
});

test("validateUpload enforces content type and size", () => {
  const policy = validateUpload({ contentType: "image/png", byteSize: 1024 });
  assert.equal(policy.kind, "image");
  assert.throws(() => validateUpload({ contentType: "application/x-msdownload", byteSize: 100 }), /Unsupported/);
});
