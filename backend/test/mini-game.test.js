import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureRoomId, hostUserId, playerUserId } from "./helpers/fixture-ids.js";
import { subscribeRoomEvents } from "../src/room-event-bus.js";
import { waitForScheduledEventOutbox } from "../src/event-outbox-dispatcher.js";

test("mini game loop starts, submits, and completes for player home", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(async () => {
    await query(`DELETE FROM room_mini_games WHERE room_id = $1`, [fixtureRoomId]);
    await app.close();
  });

  await query(`DELETE FROM room_mini_games WHERE room_id = $1`, [fixtureRoomId]);
  const roomEvents = [];
  const unsubscribe = subscribeRoomEvents(fixtureRoomId, ({ payload }) => {
    roomEvents.push(JSON.parse(payload));
  });
  context.after(unsubscribe);

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
  await waitForScheduledEventOutbox();
  const startBody = started.json();
  assert.equal(startBody.currentGame.gameType, "zhimu_lock");
  assert.equal(startBody.currentGame.attemptsLeft, 2);
  assert.equal(startBody.currentGame.config.answer_hash, undefined);
  assert.equal(roomEvents.at(-1).type, "room.game_started");
  assert.equal(roomEvents.at(-1).currentGame.instanceId, startBody.currentGame.instanceId);

  const home = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/player-home`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(home.statusCode, 200, home.body);
  assert.equal(home.json().currentGame.instanceId, startBody.currentGame.instanceId);

  const wrongKey = `mini-game-submit-${Date.now()}`;
  const wrong = await app.inject({
    method: "POST",
    url: "/api/rooms/game/submit",
    headers: { "x-user-id": playerUserId, "idempotency-key": wrongKey },
    payload: {
      roomId: fixtureRoomId,
      instanceId: startBody.currentGame.instanceId,
      answer: "0000"
    }
  });
  assert.equal(wrong.statusCode, 200, wrong.body);
  await waitForScheduledEventOutbox();
  assert.equal(wrong.json().correct, false);
  assert.equal(wrong.json().currentGame.status, "playing");
  assert.equal(wrong.json().attemptsLeft, 1);
  assert.equal(roomEvents.at(-1).type, "room.game_updated");
  assert.equal(roomEvents.at(-1).currentGame.attemptsLeft, 1);

  const wrongReplay = await app.inject({
    method: "POST",
    url: "/api/rooms/game/submit",
    headers: { "x-user-id": playerUserId, "idempotency-key": wrongKey },
    payload: {
      roomId: fixtureRoomId,
      instanceId: startBody.currentGame.instanceId,
      answer: "0000"
    }
  });
  assert.equal(wrongReplay.statusCode, 200, wrongReplay.body);
  assert.deepEqual(wrongReplay.json(), wrong.json());

  const gameAfterReplay = await query(
    `SELECT state FROM room_mini_games WHERE id = $1`,
    [startBody.currentGame.instanceId]
  );
  assert.equal(gameAfterReplay.rows[0].state.attempts_left, 1, "network retry must not consume another attempt");

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
  await waitForScheduledEventOutbox();
  assert.equal(correct.json().correct, true);
  assert.equal(correct.json().currentGame.status, "success");
  assert.equal(roomEvents.at(-1).type, "room.game_completed");
  assert.equal(roomEvents.at(-1).currentGame.status, "success");

  const afterHome = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/player-home`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(afterHome.statusCode, 200, afterHome.body);
  assert.equal(afterHome.json().currentGame, null);
});
