import assert from "node:assert/strict";
import test from "node:test";
import { allRateLimitsPositive } from "../src/routes/ops-routes.js";

test("ops production trust accepts nested positive rate-limit policies", () => {
  assert.equal(allRateLimitsPositive({
    authPerMin: 20,
    roomAccess: { joinActorPerMin: 12, joinIpPerMin: 80 },
    voice: { messageActorPerMin: 20 },
    checkpoint: { restoreActorPerMin: 3 }
  }), true);
});

test("ops production trust rejects invalid nested rate-limit policies", () => {
  assert.equal(allRateLimitsPositive({ authPerMin: 20, voice: { messageActorPerMin: 0 } }), false);
  assert.equal(allRateLimitsPositive({ authPerMin: Number.NaN }), false);
});
