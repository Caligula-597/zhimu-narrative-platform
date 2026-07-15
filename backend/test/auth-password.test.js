import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../src/auth.js";

test("password verification accepts the stored password and rejects dummy credentials", async () => {
  const stored = await hashPassword("correct-horse-battery-staple");
  assert.equal(await verifyPassword("correct-horse-battery-staple", stored.passwordHash, stored.passwordSalt), true);
  assert.equal(await verifyPassword("wrong-password", stored.passwordHash, stored.passwordSalt), false);
  assert.equal(await verifyPassword("unknown-user-password", null, null), false);
});
