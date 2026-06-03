import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { pool, query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";
const fogRoomId = "a65f94eb-a987-463c-bb81-aa482367e54a";

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

async function publicVoiceRoomId() {
  const result = await query(
    `SELECT id FROM voice_rooms WHERE room_id = $1 AND room_type = 'public' ORDER BY created_at LIMIT 1`,
    [fogRoomId]
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
      url: `/api/rooms/${fogRoomId}/voice-rooms/${voiceRoomId}/token`,
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
  });
});

test("invited player can request token for private voice room", async (context) => {
  await withLiveKitEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: true });
    context.after(() => app.close());
    const created = await app.inject({
      method: "POST",
      url: `/api/rooms/${fogRoomId}/voice-rooms`,
      headers: { "x-user-id": playerUserId },
      payload: {
        name: `LiveKit private ${Date.now()}`,
        roomType: "invite_private",
        inviteUserIds: [hostUserId]
      }
    });
    assert.equal(created.statusCode, 201);
    const voiceRoomId = created.json().id;
    const response = await app.inject({
      method: "POST",
      url: `/api/rooms/${fogRoomId}/voice-rooms/${voiceRoomId}/token`,
      headers: { "x-user-id": hostUserId }
    });
    assert.equal(response.statusCode, 200);
    assert.ok(response.json().token);
  });
});

test("uninvited active room member cannot request private voice token", async (context) => {
  await withLiveKitEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: true });
    context.after(() => app.close());
    const created = await app.inject({
      method: "POST",
      url: `/api/rooms/${fogRoomId}/voice-rooms`,
      headers: { "x-user-id": playerUserId },
      payload: {
        name: `LiveKit blocked ${Date.now()}`,
        roomType: "invite_private",
        inviteUserIds: []
      }
    });
    assert.equal(created.statusCode, 201);
    const voiceRoomId = created.json().id;
    const response = await app.inject({
      method: "POST",
      url: `/api/rooms/${fogRoomId}/voice-rooms/${voiceRoomId}/token`,
      headers: { "x-user-id": hostUserId }
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error, "Voice room membership required");
  });
});

test("host can listen to private voice room when room setting hostVoiceListen is true", async (context) => {
  await withLiveKitEnv(async () => {
    const app = await createApp({ logger: false, allowDemoUserHeader: true });
    context.after(async () => {
      await query(`UPDATE rooms SET settings = '{}'::jsonb WHERE id = $1`, [fogRoomId]);
      await app.close();
    });
    await query(
      `UPDATE rooms SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{hostVoiceListen}', 'true'::jsonb, true) WHERE id = $1`,
      [fogRoomId]
    );
    const created = await app.inject({
      method: "POST",
      url: `/api/rooms/${fogRoomId}/voice-rooms`,
      headers: { "x-user-id": playerUserId },
      payload: {
        name: `Host listen ${Date.now()}`,
        roomType: "invite_private",
        inviteUserIds: []
      }
    });
    assert.equal(created.statusCode, 201);
    const voiceRoomId = created.json().id;
    const response = await app.inject({
      method: "POST",
      url: `/api/rooms/${fogRoomId}/voice-rooms/${voiceRoomId}/token`,
      headers: { "x-user-id": hostUserId }
    });
    assert.equal(response.statusCode, 200);
    assert.ok(response.json().token);
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
      url: `/api/rooms/${fogRoomId}/voice-rooms/${voiceRoomId}/token`,
      headers: { "x-user-id": playerUserId }
    });
    assert.equal(response.statusCode, 503);
  } finally {
    for (const [key, value] of Object.entries(saved)) process.env[key] = value;
  }
});

test.after(async () => {
  await pool.end();
});
