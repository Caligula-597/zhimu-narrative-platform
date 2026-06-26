import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureRoomId, hostUserId, playerUserId } from "./helpers/fixture-ids.js";

test("mini game loop starts, submits, and completes for player home", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(async () => {
    await query(`DELETE FROM room_mini_games WHERE room_id = $1`, [fixtureRoomId]);
    await app.close();
  });

  await query(`DELETE FROM room_mini_games WHERE room_id = $1`, [fixtureRoomId]);

  const started = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/mini-games`,
    headers: { "x-user-id": hostUserId, "idempotency-key": `mini-game-start-${Date.now()}` },
    payload: {
      gameType: "zhimu_lock",
      title: "Test lock",
      prompt: "Enter the four digit code.",
      answer: "2468",
      length: 4,
      maxAttempts: 2
    }
  });
  assert.equal(started.statusCode, 200, started.body);
  const startBody = started.json();
  assert.equal(startBody.currentGame.gameType, "zhimu_lock");
  assert.equal(startBody.currentGame.attemptsLeft, 2);
  assert.equal(startBody.currentGame.config.answer_hash, undefined);

  const home = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/player-home`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(home.statusCode, 200, home.body);
  assert.equal(home.json().currentGame.instanceId, startBody.currentGame.instanceId);

  const wrong = await app.inject({
    method: "POST",
    url: "/api/rooms/game/submit",
    headers: { "x-user-id": playerUserId },
    payload: {
      roomId: fixtureRoomId,
      instanceId: startBody.currentGame.instanceId,
      answer: "0000"
    }
  });
  assert.equal(wrong.statusCode, 200, wrong.body);
  assert.equal(wrong.json().correct, false);
  assert.equal(wrong.json().currentGame.status, "playing");
  assert.equal(wrong.json().attemptsLeft, 1);

  const correct = await app.inject({
    method: "POST",
    url: "/api/rooms/game/submit",
    headers: { "x-user-id": playerUserId },
    payload: {
      roomId: fixtureRoomId,
      instance_id: startBody.currentGame.instanceId,
      answer: "2468"
    }
  });
  assert.equal(correct.statusCode, 200, correct.body);
  assert.equal(correct.json().correct, true);
  assert.equal(correct.json().currentGame.status, "success");

  const afterHome = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/player-home`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(afterHome.statusCode, 200, afterHome.body);
  assert.equal(afterHome.json().currentGame, null);
});
