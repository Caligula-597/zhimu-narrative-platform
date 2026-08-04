import assert from "node:assert/strict";
import test from "node:test";
import { runBuiltinScan, validateMagicBytes } from "../src/upload-scan-builtin.js";

test("validateMagicBytes accepts PNG header", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);
  assert.doesNotThrow(() => validateMagicBytes("image/png", png));
});

test("validateMagicBytes accepts both standard GIF signatures", () => {
  assert.doesNotThrow(() => validateMagicBytes("image/gif", Buffer.from("GIF87a")));
  assert.doesNotThrow(() => validateMagicBytes("image/gif", Buffer.from("GIF89a")));
});

test("validateMagicBytes rejects JPEG declared as PNG", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
  assert.throws(
    () => validateMagicBytes("image/png", jpeg),
    (err) => err.code === "UPLOAD_SCAN_SPOOFED"
  );
});

test("runBuiltinScan rejects blocked double extension filename", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.throws(
    () => runBuiltinScan({ buffer: png, contentType: "image/png", filename: "photo.png.exe" }),
    (err) => err.code === "UPLOAD_SCAN_SPOOFED"
  );
});

test("runBuiltinScan detects EICAR when test flag enabled", () => {
  const previous = process.env.UPLOAD_SCAN_EICAR_TEST;
  process.env.UPLOAD_SCAN_EICAR_TEST = "true";
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const eicar = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
  const buffer = Buffer.concat([png, eicar]);
  try {
    assert.throws(
      () => runBuiltinScan({ buffer, contentType: "image/png", filename: "test.png" }),
      (err) => err.code === "UPLOAD_SCAN_INFECTED"
    );
  } finally {
    if (previous === undefined) delete process.env.UPLOAD_SCAN_EICAR_TEST;
    else process.env.UPLOAD_SCAN_EICAR_TEST = previous;
  }
});
