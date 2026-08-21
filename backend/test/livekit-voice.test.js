import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { resolveLiveKitTokenTtlSeconds } from "../src/livekit.js";
import { ensureVoiceProviderRoomKey } from "../src/repositories/voice-repository.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";


const livekitEnv = {
  LIVEKIT_URL: "wss://livekit.test.example",
  LIVEKIT_API_KEY: "test-api-key",
  LIVEKIT_API_SECRET: "test-api-secret-do-not-expose"
};

function withLiveKitEnv(fn) {
  const previous = {};
  for (const [key, value] of Object.entries(livekitEnv)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  return fn().finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

async function addTemporaryVoiceInvitee(context) {
  const userId = randomUUID();
  await query(
    `INSERT INTO users (id, email, display_name, user_kind, email_verified_at)
     VALUES ($1, $2, '临时语音玩家', 'registered', now())`,
    [userId, `voice-${userId}@zhimu.local`]
  );
  await query(
    `INSERT INTO room_members (room_id, user_id, member_type) VALUES ($1, $2, 'player')`,
    [fixtureRoomId, userId]
  );
  context.after(async () => {
    await query(`DELETE FROM voice_room_members WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM room_members WHERE room_id = $1 AND user_id = $2`, [fixtureRoomId, userId]);
    await query(`DELETE FROM users WHERE id = $1`, [userId]);
  });
  return userId;
}

async function publicVoiceRoomId() {
  const result = await query(
    `SELECT id FROM voice_rooms WHERE room_id = $1 AND room_type = 'public' ORDER BY created_at LIMIT 1`,
    [fixtureRoomId]
  );
  assert.ok(result.rowCount, "public voice room fixture required");
  return result.rows[0].id;
}

test("player can request LiveKit token for public voice room", async (context) => {
  await withLiveKitEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: true });
    context.after(() => app.close());
    const voiceRoomId = await publicVoiceRoomId();
    const response = await app.inject({
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/voice-rooms/${voiceRoomId}/token`,
      headers: { "x-user-id": playerUserId }
    });
    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.ok(payload.token);
    assert.equal(payload.url, livekitEnv.LIVEKIT_URL);
    assert.match(payload.roomName, /^zhimu-voice-/);
    assert.equal(payload.voiceRoomId, voiceRoomId);
    assert.notEqual(payload.token, livekitEnv.LIVEKIT_API_SECRET);
    assert.ok(!JSON.stringify(payload).includes(livekitEnv.LIVEKIT_API_SECRET));
    const jwtPayload = JSON.parse(Buffer.from(payload.token.split(".")[1], "base64url").toString("utf8"));
    assert.ok(jwtPayload.exp - jwtPayload.nbf <= 600, "voice admission token must be short-lived");
  });
});

test("invited player can request token for private voice room", async (context) => {
  await withLiveKitEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: true });
    context.after(() => app.close());
    const created = await app.inject({
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/voice-rooms`,
      headers: { "x-user-id": playerUserId },
      payload: {
        name: `LiveKit private ${Date.now()}`,
        roomType: "invite_private",
        inviteUserIds: [hostUserId]
      }
    });
    assert.equal(created.statusCode, 201);
    const voiceRoomId = created.json().id;
    context.after(() => query(`DELETE FROM voice_rooms WHERE id = $1`, [voiceRoomId]));
    const response = await app.inject({
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/voice-rooms/${voiceRoomId}/token`,
      headers: { "x-user-id": hostUserId }
    });
    assert.equal(response.statusCode, 200);
    assert.ok(response.json().token);

  });
});

test("uninvited active room member cannot request private voice token", async (context) => {
  await withLiveKitEnv(async () => {
    const temporaryInviteeId = await addTemporaryVoiceInvitee(context);
    const app = await createApp({ logger: false, allowDemoUserHeader: true });
    context.after(() => app.close());
    const created = await app.inject({
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/voice-rooms`,
      headers: { "x-user-id": playerUserId },
      payload: {
        name: `LiveKit blocked ${Date.now()}`,
        roomType: "invite_private",
        inviteUserIds: [temporaryInviteeId]
      }
    });
    assert.equal(created.statusCode, 201);
    const voiceRoomId = created.json().id;
    context.after(() => query(`DELETE FROM voice_rooms WHERE id = $1`, [voiceRoomId]));
    const response = await app.inject({
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/voice-rooms/${voiceRoomId}/token`,
      headers: { "x-user-id": hostUserId }
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error, "Voice room membership required");
  });
});

test("host can listen to private voice room when room setting hostVoiceListen is true", async (context) => {
  await withLiveKitEnv(async () => {
    const temporaryInviteeId = await addTemporaryVoiceInvitee(context);
    const app = await createApp({ logger: false, allowDemoUserHeader: true });
    context.after(async () => {
      await query(`UPDATE rooms SET settings = '{}'::jsonb WHERE id = $1`, [fixtureRoomId]);
      await app.close();
    });
    await query(
      `UPDATE rooms SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{hostVoiceListen}', 'true'::jsonb, true) WHERE id = $1`,
      [fixtureRoomId]
    );
    const created = await app.inject({
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/voice-rooms`,
      headers: { "x-user-id": playerUserId },
      payload: {
        name: `Host listen ${Date.now()}`,
        roomType: "invite_private",
        inviteUserIds: [temporaryInviteeId]
      }
    });
    assert.equal(created.statusCode, 201);
    const voiceRoomId = created.json().id;
    context.after(() => query(`DELETE FROM voice_rooms WHERE id = $1`, [voiceRoomId]));
    const response = await app.inject({
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/voice-rooms/${voiceRoomId}/token`,
      headers: { "x-user-id": hostUserId }
    });
    assert.equal(response.statusCode, 200);
    assert.ok(response.json().token);

    const messageAttempt = await app.inject({
      method: "POST",
      url: `/api/voice-rooms/${voiceRoomId}/messages`,
      headers: { "x-user-id": hostUserId },
      payload: { body: "旁听主持人不应能插话" }
    });
    assert.equal(messageAttempt.statusCode, 403);
    assert.equal(messageAttempt.json().code, "VOICE_ACCESS_DENIED");

    const memberAttempt = await app.inject({
      method: "POST",
      url: `/api/voice-rooms/${voiceRoomId}/members`,
      headers: { "x-user-id": hostUserId },
      payload: { inviteUserIds: [hostUserId] }
    });
    assert.equal(memberAttempt.statusCode, 403);
    assert.equal(memberAttempt.json().code, "VOICE_ACCESS_DENIED");
  });
});

test("token endpoint returns 503 when LiveKit env is missing", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const voiceRoomId = await publicVoiceRoomId();
  const saved = { ...livekitEnv };
  for (const key of Object.keys(livekitEnv)) delete process.env[key];
  try {
    const response = await app.inject({
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/voice-rooms/${voiceRoomId}/token`,
      headers: { "x-user-id": playerUserId }
    });
    assert.equal(response.statusCode, 503);
  } finally {
    for (const [key, value] of Object.entries(saved)) process.env[key] = value;
  }
});

test("LiveKit token TTL rejects unsafe environment values", () => {
  assert.equal(resolveLiveKitTokenTtlSeconds("59"), 600);
  assert.equal(resolveLiveKitTokenTtlSeconds("3601"), 600);
  assert.equal(resolveLiveKitTokenTtlSeconds("300"), 300);
});

test("provider key initialization never overwrites an existing provider room", async (context) => {
  const voiceRoomId = await publicVoiceRoomId();
  context.after(() => query(`UPDATE voice_rooms SET provider_room_key = NULL WHERE id = $1`, [voiceRoomId]));
  await query(`UPDATE voice_rooms SET provider_room_key = 'pre-provisioned-room' WHERE id = $1`, [voiceRoomId]);
  const providerKey = await ensureVoiceProviderRoomKey(voiceRoomId, `zhimu-voice-${voiceRoomId}`);
  assert.equal(providerKey, "pre-provisioned-room");
  const persisted = await query(`SELECT provider_room_key FROM voice_rooms WHERE id = $1`, [voiceRoomId]);
  assert.equal(persisted.rows[0].provider_room_key, "pre-provisioned-room");
});
