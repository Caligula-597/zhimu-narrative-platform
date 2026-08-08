import assert from "node:assert/strict";
import test from "node:test";
import { secureRandomId } from "../shared/secure-random.js";

test("secureRandomId prefers randomUUID and preserves the operation prefix", () => {
  const id = secureRandomId("host-write", {
    randomUUID: () => "123e4567-e89b-42d3-a456-426614174000"
  });
  assert.equal(id, "host-write-123e4567-e89b-42d3-a456-426614174000");
});

test("secureRandomId uses getRandomValues without Math.random fallback", () => {
  const id = secureRandomId("idem", {
    getRandomValues(bytes) {
      bytes.fill(0xab);
      return bytes;
    }
  });
  assert.match(id, /^idem-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
});

test("secureRandomId fails closed when cryptographic randomness is unavailable", () => {
  assert.throws(() => secureRandomId("idem", null), /Secure random number generator is unavailable/u);
});
