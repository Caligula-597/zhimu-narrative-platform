import assert from "node:assert/strict";
import test from "node:test";
import { generateRoomInviteCode } from "../src/room-invite-code.js";

test("room invite codes carry 80 random bits in human-readable groups", () => {
  const codes = Array.from({ length: 1_000 }, () => generateRoomInviteCode("room"));
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) {
    assert.match(code, /^ROOM-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/);
  }
});

test("invite code prefixes are normalized and bounded", () => {
  assert.match(generateRoomInviteCode(" play "), /^PLAY-/);
  assert.match(generateRoomInviteCode("../../strange prefix"), /^STRANGEPREFI-/);
  assert.match(generateRoomInviteCode("---"), /^ROOM-/);
});
