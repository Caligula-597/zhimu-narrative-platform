import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import {
  fixtureWorldId,
  hostUserId,
  playerUserId
} from "./helpers/fixture-ids.js";

test("players stay in the all-hands voice room until the host formally starts the session", async (context) => {
  const roomId = randomUUID();
  const inviteCode = `VOICE-LIFECYCLE-${Date.now()}`;
  await query(
    `INSERT INTO rooms (id, world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, $3, '语音生命周期测试', $4, 'testing')`,
    [roomId, fixtureWorldId, hostUserId, inviteCode]
  );
  await query(
    `INSERT INTO room_members (room_id, user_id, member_type)
     VALUES ($1, $2, 'host'), ($1, $3, 'player')`,
    [roomId, hostUserId, playerUserId]
  );
  const legacyPrivateRoom = await query(
    `WITH private_room AS (
       INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
       VALUES ($1, '候场遗留密谈', 'invite_private', $2)
       RETURNING id
     )
     INSERT INTO voice_room_members (voice_room_id, user_id, invited_by_user_id)
     SELECT id, $3, $2 FROM private_room
     RETURNING voice_room_id`,
    [roomId, hostUserId, playerUserId]
  );
  const legacyPrivateRoomId = legacyPrivateRoom.rows[0].voice_room_id;
  await query(
    `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
     VALUES ($1, '全员主语音房', 'public', $2)`,
    [roomId, hostUserId]
  );

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(async () => {
    await app.close();
    await query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
  });

  const sessionBefore = await app.inject({
    method: "GET",
    url: `/api/rooms/${roomId}/voice-session`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(sessionBefore.statusCode, 200, sessionBefore.body);
  assert.equal(sessionBefore.json().voicePolicy.privateRoomsEnabled, false);
  assert.equal(sessionBefore.json().voiceRooms.length, 1);
  assert.deepEqual(
    sessionBefore.json().voiceRoster.map((member) => member.member_type),
    ["host", "player"]
  );

  const blockedLegacyMessages = await app.inject({
    method: "GET",
    url: `/api/voice-rooms/${legacyPrivateRoomId}/messages`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(blockedLegacyMessages.statusCode, 409, blockedLegacyMessages.body);
  assert.equal(blockedLegacyMessages.json().code, "VOICE_PRIVATE_BEFORE_START");

  const blockedLegacyToken = await app.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/voice-rooms/${legacyPrivateRoomId}/token`,
    headers: { "x-user-id": playerUserId },
    payload: {}
  });
  assert.equal(blockedLegacyToken.statusCode, 409, blockedLegacyToken.body);
  assert.equal(blockedLegacyToken.json().code, "VOICE_PRIVATE_BEFORE_START");

  const blockedPrivateRoom = await app.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/voice-rooms`,
    headers: { "x-user-id": playerUserId },
    payload: { name: "过早密谈", roomType: "invite_private", inviteUserIds: [] }
  });
  assert.equal(blockedPrivateRoom.statusCode, 409, blockedPrivateRoom.body);
  assert.equal(blockedPrivateRoom.json().code, "VOICE_PRIVATE_BEFORE_START");

  const playerStart = await app.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/host/start`,
    headers: { "x-user-id": playerUserId },
    payload: {}
  });
  assert.equal(playerStart.statusCode, 403, playerStart.body);

  const started = await app.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/host/start`,
    headers: { "x-user-id": hostUserId },
    payload: {}
  });
  assert.equal(started.statusCode, 200, started.body);
  assert.equal(started.json().alreadyStarted, false);
  assert.equal(started.json().room.status, "active");
  assert.ok(started.json().room.started_at);

  const repeated = await app.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/host/start`,
    headers: { "x-user-id": hostUserId },
    payload: {}
  });
  assert.equal(repeated.statusCode, 200, repeated.body);
  assert.equal(repeated.json().alreadyStarted, true);

  const privateRoom = await app.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/voice-rooms`,
    headers: { "x-user-id": playerUserId },
    payload: { name: "开场后密谈", roomType: "invite_private", inviteUserIds: [] }
  });
  assert.equal(privateRoom.statusCode, 201, privateRoom.body);

  const sessionAfter = await app.inject({
    method: "GET",
    url: `/api/rooms/${roomId}/voice-session`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(sessionAfter.statusCode, 200, sessionAfter.body);
  assert.equal(sessionAfter.json().voicePolicy.privateRoomsEnabled, true);
  assert.equal(sessionAfter.json().voiceRooms.length, 3);
});
