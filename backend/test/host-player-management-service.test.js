import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHostPlayerManagementError } from "../src/host-player-management-service.js";

test("database contention becomes typed host player management errors", () => {
  const busy = normalizeHostPlayerManagementError({ code: "55P03" });
  assert.equal(busy.statusCode, 409);
  assert.equal(busy.code, "HOST_PLAYER_MANAGEMENT_BUSY");
  const timeout = normalizeHostPlayerManagementError({ code: "57014" });
  assert.equal(timeout.statusCode, 503);
  assert.equal(timeout.code, "HOST_PLAYER_MANAGEMENT_TIMEOUT");
});
