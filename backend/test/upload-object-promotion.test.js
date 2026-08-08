import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStorage, clearMemoryStorage } from "../src/storage/memory-storage.js";
import { promoteScannedObject } from "../src/upload-object-promotion.js";

test.beforeEach(() => clearMemoryStorage());

test("scanned uploads are copied to an immutable destination object", async () => {
  const storage = new MemoryStorage();
  const sourceKey = "staging/source";
  const destinationKey = "published/final";
  const body = Buffer.from("safe-image-body");
  await storage.putObject({ key: sourceKey, body, contentType: "image/png" });
  const stat = await storage.statObject({ key: sourceKey });

  await promoteScannedObject({
    sourceKey,
    destinationKey,
    sourceEtag: stat.etag,
    contentType: stat.contentType,
    byteSize: stat.byteSize,
    storage
  });
  await storage.putObject({
    key: sourceKey,
    body: Buffer.from("evil-replacement"),
    contentType: "image/png"
  });

  assert.deepEqual(await storage.readObjectBytes({ key: destinationKey }), body);
});

test("promotion rejects a source overwritten after the security scan", async () => {
  const storage = new MemoryStorage();
  const sourceKey = "staging/raced";
  const destinationKey = "published/rejected";
  await storage.putObject({
    key: sourceKey,
    body: Buffer.from("safe-content"),
    contentType: "image/png"
  });
  const scanned = await storage.statObject({ key: sourceKey });
  await storage.putObject({
    key: sourceKey,
    body: Buffer.from("evil-content"),
    contentType: "image/png"
  });

  await assert.rejects(
    promoteScannedObject({
      sourceKey,
      destinationKey,
      sourceEtag: scanned.etag,
      contentType: scanned.contentType,
      byteSize: scanned.byteSize,
      storage
    }),
    (error) => error.code === "UPLOAD_SCAN_SPOOFED"
  );
  await assert.rejects(storage.statObject({ key: destinationKey }), /Object not found/u);
});

test("promotion fails closed when storage cannot bind the scan to an object identity", async () => {
  const storage = new MemoryStorage();
  await storage.putObject({
    key: "staging/no-etag",
    body: Buffer.from("safe-content"),
    contentType: "image/png"
  });
  await assert.rejects(
    promoteScannedObject({
      sourceKey: "staging/no-etag",
      destinationKey: "published/no-etag",
      sourceEtag: null,
      contentType: "image/png",
      byteSize: 12,
      storage
    }),
    (error) => error.code === "UPLOAD_SCAN_FAILED"
  );
  await assert.rejects(storage.statObject({ key: "published/no-etag" }), /Object not found/u);
});
