import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTENT_PACKAGE_JSON_BODY_LIMIT_BYTES,
  CONTENT_PACKAGE_MAX_TOTAL_ENTITIES,
  assertContentPackageWithinLimits
} from "../src/content-package-limits.js";
import { createWorldFromPackageSchema } from "../src/routes/schemas/creator-rules-package.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("content package body limit supports real archives without becoming unbounded", () => {
  assert.equal(CONTENT_PACKAGE_JSON_BODY_LIMIT_BYTES, 16 * 1024 * 1024);
  assert.equal(CONTENT_PACKAGE_MAX_TOTAL_ENTITIES, 5_000);
});

test("content package collection limits reject oversized or malformed collections", () => {
  assert.deepEqual(assertContentPackageWithinLimits({ roles: [], chapters: [], sections: [{}] }), { total: 1 });
  assert.throws(
    () => assertContentPackageWithinLimits({ roles: [], chapters: [], sections: new Array(8_001).fill({}) }),
    (error) => error?.code === "CONTENT_PACKAGE_TOO_LARGE" && error?.statusCode === 413
  );
  assert.throws(
    () => assertContentPackageWithinLimits({ roles: [], chapters: [], sections: {} }),
    (error) => error?.code === "CONTENT_PACKAGE_TOO_LARGE"
  );
  assert.throws(
    () => assertContentPackageWithinLimits({ roles: new Array(500).fill({}), chapters: new Array(1_000).fill({}), sections: new Array(3_501).fill({}) }),
    (error) => error?.code === "CONTENT_PACKAGE_TOO_LARGE"
  );
});

test("new-world package imports carry a replay-safe request id", () => {
  const requestId = createWorldFromPackageSchema.body.properties.requestId;
  assert.equal(requestId.maxLength, 128);
  assert.match(requestId.pattern, /A-Za-z0-9/);
  const service = fs.readFileSync(path.join(root, "src/routes/content-package-helpers.js"), "utf8");
  assert.match(service, /pg_advisory_xact_lock/);
  assert.match(service, /contentPackageCreationRequestId/);
});
