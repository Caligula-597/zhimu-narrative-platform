import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveRecycleBinDays,
  resolveSignedDownloadTtlSeconds,
  resolveSignedUploadTtlSeconds
} from "../src/asset-lifetime-policy.js";

test("asset lifetime policy accepts safe explicit values", () => {
  assert.equal(resolveSignedUploadTtlSeconds("900"), 900);
  assert.equal(resolveSignedDownloadTtlSeconds("120"), 120);
  assert.equal(resolveRecycleBinDays("30"), 30);
});

test("asset lifetime policy falls back for invalid or excessive values", () => {
  assert.equal(resolveSignedUploadTtlSeconds("0"), 600);
  assert.equal(resolveSignedUploadTtlSeconds("86400"), 600);
  assert.equal(resolveSignedDownloadTtlSeconds("not-a-number"), 300);
  assert.equal(resolveSignedDownloadTtlSeconds("3601"), 300);
  assert.equal(resolveRecycleBinDays("-1"), 14);
  assert.equal(resolveRecycleBinDays("366"), 14);
});
