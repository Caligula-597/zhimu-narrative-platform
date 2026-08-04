import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  cleanupExpiredUploads,
  resolveExpiredUploadCleanupOptions
} from "../src/expired-upload-cleanup.js";
import { TERMINAL_UPLOAD_SESSION_RETENTION_PREDICATE } from "../src/data-retention.js";

test("expired upload cleanup options are bounded", () => {
  assert.deepEqual(resolveExpiredUploadCleanupOptions({
    UPLOAD_CLEANUP_BATCH_SIZE: "25",
    UPLOAD_CLEANUP_GRACE_SECONDS: "120"
  }), { batchSize: 25, graceSeconds: 120 });
  assert.deepEqual(resolveExpiredUploadCleanupOptions({
    UPLOAD_CLEANUP_BATCH_SIZE: "0",
    UPLOAD_CLEANUP_GRACE_SECONDS: "999999"
  }), { batchSize: 500, graceSeconds: 900 });
});

test("expired upload cleanup keeps failed objects retryable and continues the batch", async () => {
  const calls = [];
  const db = async (sql, params) => {
    calls.push([sql, params]);
    if (/SELECT us\.id/u.test(sql)) {
      return {
        rows: [
          { upload_session_id: "session-1", asset_id: "asset-1", object_key: "objects/fail" },
          { upload_session_id: "session-2", asset_id: "asset-2", object_key: "objects/ok" }
        ]
      };
    }
    return { rowCount: 1, rows: [] };
  };
  const storage = {
    async deleteObject({ key }) {
      if (key === "objects/fail") throw new Error("temporary storage failure");
    }
  };
  const summary = await cleanupExpiredUploads({ db, storage, batchSize: 10, graceSeconds: 120 });
  assert.deepEqual(summary, {
    selected: 2,
    deleted: 1,
    failed: 1,
    failures: [{
      uploadSessionId: "session-1",
      assetId: "asset-1",
      message: "temporary storage failure"
    }]
  });
  assert.match(calls[0][0], /us\.status IN \('created', 'expired'\)/u);
  assert.match(calls[0][0], /a\.status = 'pending_upload'/u);
  assert.deepEqual(calls[0][1], [120, 10]);
  assert.equal(calls.filter(([sql]) => /DELETE FROM asset_files/u.test(sql)).length, 1);
});

test("general retention only removes terminal upload sessions", () => {
  assert.match(TERMINAL_UPLOAD_SESSION_RETENTION_PREDICATE, /confirmed/u);
  assert.match(TERMINAL_UPLOAD_SESSION_RETENTION_PREDICATE, /cancelled/u);
  assert.doesNotMatch(TERMINAL_UPLOAD_SESSION_RETENTION_PREDICATE, /created|expired|uploaded/u);
});

test("the existing retention worker schedules expired object cleanup", async () => {
  const source = await fs.readFile(new URL("../src/data-retention-worker.js", import.meta.url), "utf8");
  assert.match(source, /await purgeExpiredData\(\)/u);
  assert.match(source, /await cleanupExpiredUploads\(\)/u);
});
