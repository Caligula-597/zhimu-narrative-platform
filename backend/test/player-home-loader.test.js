import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { playerUserId, fixtureRoomId } from "./helpers/fixture-ids.js";

test("player-home returns full payload via parallel loader", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/player-home`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  for (const key of [
    "room",
    "role",
    "sections",
    "notes",
    "clues",
    "sharedClues",
    "voiceRooms",
    "roomMembers",
    "inventory",
    "hostConfirm",
    "tasks",
    "suspicions",
    "testimonies",
    "activeVotes",
    "privateActions",
    "segments"
  ]) {
    assert.ok(key in body, `missing ${key}`);
  }
  assert.ok(body.room?.id);
  assert.ok(body.role?.id);
});

test("player-home core and social slices compose the legacy payload contract", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const headers = { "x-user-id": playerUserId };
  const [fullRes, coreRes, socialRes] = await Promise.all([
    app.inject({ method: "GET", url: `/api/rooms/${fixtureRoomId}/player-home`, headers }),
    app.inject({ method: "GET", url: `/api/rooms/${fixtureRoomId}/player-home/core`, headers }),
    app.inject({ method: "GET", url: `/api/rooms/${fixtureRoomId}/player-home/social`, headers })
  ]);
  assert.equal(fullRes.statusCode, 200, fullRes.body);
  assert.equal(coreRes.statusCode, 200, coreRes.body);
  assert.equal(socialRes.statusCode, 200, socialRes.body);
  const full = fullRes.json();
  const composed = { ...coreRes.json(), ...socialRes.json() };
  for (const key of Object.keys(full)) {
    assert.ok(key in composed, `split payload missing ${key}`);
  }
  assert.equal(composed.room.id, full.room.id);
  assert.equal(composed.role.id, full.role.id);
});

test("player-home core single-query path preserves membership isolation", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/player-home/core`,
    headers: { "x-user-id": "99999999-9999-4999-8999-999999999999" }
  });
  assert.equal(response.statusCode, 403, response.body);
  assert.equal(response.json().code, "ROOM_MEMBERSHIP_REQUIRED");
});
