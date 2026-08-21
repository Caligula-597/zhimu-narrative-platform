import assert from "node:assert/strict";
import test from "node:test";
import { query } from "../src/db.js";
import { createVoiceRoomForActor, resolveVoiceRuntimePolicy } from "../src/voice-service.js";
import { fixtureRoomId, hostUserId } from "./helpers/fixture-ids.js";

const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";

test("private voice rooms expire and concurrent creates cannot cross the room quota", async (context) => {
  const prefix = `voice-quota-${Date.now()}-`;
  context.after(() => query(`DELETE FROM voice_rooms WHERE room_id = $1 AND name LIKE $2`, [fixtureRoomId, `${prefix}%`]));
  const before = await query(
    `SELECT COUNT(*)::int AS count
     FROM voice_rooms
     WHERE room_id = $1 AND status = 'active'
       AND (expires_at IS NULL OR expires_at > now())`,
    [fixtureRoomId]
  );
  const activeRoomLimit = before.rows[0].count + 1;
  const create = (suffix) => createVoiceRoomForActor({
    actorId: playerUserId,
    roomId: fixtureRoomId,
    membership: { member_type: "player" },
    name: `${prefix}${suffix}`,
    roomType: "invite_private",
    inviteUserIds: [hostUserId],
    activeRoomLimit,
    privateRoomLifetimeHours: 24
  });

  const results = await Promise.allSettled([create("a"), create("b")]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "VOICE_ROOM_LIMIT_REACHED");
  const expiryMs = new Date(fulfilled[0].value.expires_at).getTime() - Date.now();
  assert.ok(expiryMs > 23 * 60 * 60_000 && expiryMs <= 24 * 60 * 60_000);
});

test("voice runtime policy bounds quota and private room lifetime", () => {
  assert.deepEqual(resolveVoiceRuntimePolicy({
    VOICE_ROOM_ACTIVE_LIMIT: "0",
    VOICE_PRIVATE_ROOM_LIFETIME_HOURS: "999"
  }), {
    activeRoomLimit: 30,
    privateRoomLifetimeHours: 24
  });
  assert.deepEqual(resolveVoiceRuntimePolicy({
    VOICE_ROOM_ACTIVE_LIMIT: "12",
    VOICE_PRIVATE_ROOM_LIFETIME_HOURS: "48"
  }), {
    activeRoomLimit: 12,
    privateRoomLifetimeHours: 48
  });
});
