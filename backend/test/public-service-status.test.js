import assert from "node:assert/strict";
import test from "node:test";
import { getPublicEmailServiceStatus } from "../src/email.js";

test("public email readiness does not expose provider or operations addresses", () => {
  const status = getPublicEmailServiceStatus();
  assert.deepEqual(Object.keys(status), ["configured"]);
  assert.equal(typeof status.configured, "boolean");
  assert.equal("provider" in status, false);
  assert.equal("addresses" in status, false);
  assert.equal("publicAppUrl" in status, false);
});
