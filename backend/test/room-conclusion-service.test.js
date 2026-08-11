import assert from "node:assert/strict";
import test from "node:test";
import { projectRoomConclusion } from "../src/room-conclusion-service.js";
import { filterRecapForPlayer } from "../src/recap-projection-service.js";

function stored(status = "failed") {
  return {
    revision: 3,
    updatedAt: "2026-08-11T13:00:00.000Z",
    payload: {
      status,
      endingId: "escape",
      recapId: null,
      idempotencyKey: "conclusion:room:escape",
      failureCode: "PRIVATE_PROVIDER_FAILURE",
    },
  };
}

test("player conclusion projection exposes progress without internal retry data", () => {
  const player = projectRoomConclusion(stored(), { audience: "player" });
  assert.equal(player.status, "failed");
  assert.equal(player.endingId, "escape");
  assert.equal("failureCode" in player, false);
  assert.equal("idempotencyKey" in player, false);
  assert.equal(projectRoomConclusion(stored(), { audience: "host" }).failureCode, "PRIVATE_PROVIDER_FAILURE");
});

test("player recap keeps the ending reference but strips the conclusion key", () => {
  const projected = filterRecapForPlayer({
    conclusion: { idempotencyKey: "secret-retry-key", endingId: "escape" },
    rolePerformances: [],
    notes: [],
  }, "role-1");
  assert.deepEqual(projected.conclusion, { endingId: "escape" });
  assert.equal(JSON.stringify(projected).includes("secret-retry-key"), false);
});
