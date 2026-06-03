const baseUrl = process.env.SMOKE_API_BASE_URL || "http://localhost:4180/api";
const hostUserId = process.env.SMOKE_HOST_USER_ID || "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = process.env.SMOKE_PLAYER_USER_ID || "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";
const worldId = process.env.SMOKE_WORLD_ID || "08646748-e4ae-446a-a5e7-ce59ca23ffc3";
const roomId = process.env.SMOKE_ROOM_ID || "a65f94eb-a987-463c-bb81-aa482367e54a";

async function request(path, userId, { method = "GET", body } = {}) {
  const headers = {};
  if (userId) headers["x-user-id"] = userId;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${path}: ${payload.error || "request failed"}`);
  return payload;
}

async function check(name, action) {
  try {
    const detail = await action();
    console.log(`PASS ${name}: ${detail}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    return false;
  }
}

const results = await Promise.all([
  check("health", async () => (await request("/health")).ok),
  check("world-list", async () => (await request("/worlds", hostUserId)).length),
  check("studio", async () => {
    const studio = await request(`/worlds/${worldId}/studio`, hostUserId);
    return `roles=${studio.roles.length}, chapters=${studio.chapters.length}, rooms=${studio.rooms.length}`;
  }),
  check("rules", async () => (await request(`/worlds/${worldId}/rules`, hostUserId)).length),
  check("player-home", async () => {
    const home = await request(`/rooms/${roomId}/player-home`, playerUserId);
    return `sections=${home.sections.length}, voiceRooms=${home.voiceRooms.length}`;
  }),
  check("voice-room-append-invite", async () => {
    const home = await request(`/rooms/${roomId}/player-home`, playerUserId);
    const privateRoom = home.voiceRooms.find((room) => room.room_type === "invite_private");
    if (!privateRoom) throw new Error("expected at least one private voice room fixture");
    const response = await fetch(`${baseUrl}/voice-rooms/${privateRoom.id}/members`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-id": playerUserId },
      body: JSON.stringify({ inviteUserIds: [playerUserId] })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(`${response.status}: ${payload.error || "append invite failed"}`);
    return payload.invited;
  }),
  check("exploration", async () => {
    const exploration = await request(`/rooms/${roomId}/exploration`, playerUserId);
    const points = exploration.scenes.flatMap((scene) => scene.investigation_points ?? []);
    return `scenes=${exploration.scenes.length}, investigationPoints=${points.length}`;
  }),
  check("host-progress", async () => (await request(`/rooms/${roomId}/host-progress`, hostUserId)).length),
  check("host-players", async () => {
    const payload = await request(`/rooms/${roomId}/host/players`, hostUserId);
    return `players=${payload.players.length}, stuck=${payload.stuckCount}`;
  }),
  check("checkpoints", async () => {
    const created = await request(`/rooms/${roomId}/checkpoints`, hostUserId, {
      method: "POST",
      body: { title: "smoke checkpoint", description: "api smoke" }
    });
    const list = await request(`/rooms/${roomId}/checkpoints`, hostUserId);
    const detail = await request(`/rooms/${roomId}/checkpoints/${created.id}`, hostUserId);
    return `list=${list.length}, snapshotPlayers=${detail.snapshot.players.length}`;
  }),
  check("join-rejects-foreign-role", async () => {
    const response = await fetch(`${baseUrl}/rooms/join`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-id": playerUserId },
      body: JSON.stringify({ inviteCode: "FOG-HARBOR-DEMO", roleSlotId: "00000000-0000-4000-8000-000000000000" })
    });
    if (response.status !== 400) throw new Error(`expected 400, received ${response.status}`);
    return response.status;
  }),
  check("invite-code-loads-room-roles", async () => {
    const invite = await request("/rooms/invite/FOG-HARBOR-DEMO", playerUserId);
    return `world=${invite.world.name}, roles=${invite.roles.length}`;
  }),
  check("unauthenticated-rejected", async () => {
    const response = await fetch(`${baseUrl}/auth/me`);
    if (response.status !== 401) throw new Error(`expected 401, received ${response.status}`);
    return response.status;
  })
]);

if (results.some((result) => !result)) process.exitCode = 1;
