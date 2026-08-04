import assert from "node:assert/strict";
import test from "node:test";
import { validateBufferedWorldAssetInput } from "../src/asset-upload-helpers.js";
import {
  admitWorldCreation,
  assertAssetUploadQuota,
  createStorageQuotaReservation,
  lockAssetQuotaAdmission,
  lockWorldQuotaAdmission
} from "../src/quota-guards.js";

function quota(overrides = {}) {
  return {
    plan_code: "free",
    max_bytes: 100,
    max_worlds: 2,
    max_single_file_bytes: 60,
    used_bytes: 80,
    used_worlds: 1,
    ...overrides
  };
}

test("request-scoped storage reservation enforces cumulative imported bytes", async () => {
  const reservation = await createStorageQuotaReservation("user-1", {
    fetchQuota: async () => quota()
  });
  const releaseFirst = reservation.reserve(12);
  assert.equal(reservation.reservedBytes, 12);
  assert.throws(
    () => reservation.reserve(9),
    (error) => error.code === "STORAGE_QUOTA_EXCEEDED"
      && error.details.reservedBytes === 12
      && error.details.shortfallBytes === 1
  );
  releaseFirst();
  assert.equal(reservation.reservedBytes, 0);
  assert.doesNotThrow(() => reservation.reserve(20));
});

test("request-scoped storage reservation enforces the account single-file limit", async () => {
  const reservation = await createStorageQuotaReservation("user-1", {
    fetchQuota: async () => quota({ used_bytes: 0 })
  });
  assert.throws(
    () => reservation.reserve(61),
    (error) => error.code === "FILE_TOO_LARGE"
      && error.details.maxSingleFileBytes === 60
  );
});

test("final asset admission checks single-file and storage limits from one transaction snapshot", async () => {
  let calls = 0;
  const fetchQuota = async (_userId, client) => {
    calls += 1;
    assert.equal(client, "transaction-client");
    return quota({ used_bytes: 90 });
  };
  await assert.rejects(
    () => assertAssetUploadQuota("user-1", 11, {
      client: "transaction-client",
      fetchQuota
    }),
    (error) => error.code === "STORAGE_QUOTA_EXCEEDED"
  );
  assert.equal(calls, 1);
});

test("asset quota admission uses a transaction-scoped per-account advisory lock", async () => {
  const queries = [];
  await lockAssetQuotaAdmission({
    query: async (...args) => {
      queries.push(args);
      return { rows: [] };
    }
  }, "user-1");
  assert.equal(queries.length, 1);
  assert.match(queries[0][0], /pg_advisory_xact_lock\(hashtextextended/u);
  assert.deepEqual(queries[0][1], ["asset-quota:user-1"]);
});

test("world quota admission locks the account before reading its transaction snapshot", async () => {
  const calls = [];
  const client = {
    query: async (sql, params) => {
      calls.push([sql, params]);
      if (/FROM user_plans/u.test(sql)) {
        return {
          rows: [{
            plan_code: "free",
            stored_max_bytes: null,
            stored_max_worlds: 2,
            stored_max_single_file_bytes: null,
            used_bytes: 0,
            used_worlds: 1
          }]
        };
      }
      return { rows: [] };
    }
  };
  await admitWorldCreation(client, "user-1");
  assert.match(calls[0][0], /pg_advisory_xact_lock/u);
  assert.deepEqual(calls[0][1], ["world-quota:user-1"]);
  assert.match(calls[1][0], /FROM user_plans/u);
});

test("world quota lock rejects callers without a transaction client", async () => {
  await assert.rejects(() => lockWorldQuotaAdmission(null, "user-1"), /transaction client/u);
});

test("buffered asset admission applies the same type, name and visibility policy as direct uploads", () => {
  const gif = Buffer.from("GIF89a");
  assert.deepEqual(validateBufferedWorldAssetInput({
    filename: "clue.gif",
    buffer: gif,
    contentType: "image/gif",
    visibility: "author",
    assetKind: "image"
  }), {
    filename: "clue.gif",
    byteSize: gif.length,
    assetKind: "image"
  });
  assert.throws(
    () => validateBufferedWorldAssetInput({
      filename: "clue.gif",
      buffer: gif,
      contentType: "image/gif",
      visibility: "author",
      assetKind: "document"
    }),
    (error) => error.code === "UPLOAD_TYPE_MISMATCH"
  );
  assert.throws(
    () => validateBufferedWorldAssetInput({
      filename: "../clue.gif",
      buffer: gif,
      contentType: "image/gif",
      visibility: "author",
      assetKind: "image"
    }),
    /Invalid filename/u
  );
  assert.throws(
    () => validateBufferedWorldAssetInput({
      filename: "clue.gif",
      buffer: gif,
      contentType: "image/gif",
      visibility: "everyone",
      assetKind: "image"
    }),
    (error) => error.code === "ASSET_VISIBILITY_INVALID"
  );
});
