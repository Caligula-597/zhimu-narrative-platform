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
