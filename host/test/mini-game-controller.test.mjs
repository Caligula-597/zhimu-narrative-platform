import assert from "node:assert/strict";
import test from "node:test";

import {
  applyHostMiniGameEvent,
  createHostMiniGameActionHandler,
  creatorMiniGameTemplates,
  hostMiniGameCard
} from "../src/runtime/host-mini-game-controller.js";

function fixtureState() {
  return {
    studio: {
      world: {
        settings: {
          miniGameTemplates: [{
            id: "lock-1",
            title: "档案柜密码",
            prompt: "输入四位密码",
            answer: "2468",
            length: 4,
            maxAttempts: 3
          }]
        }
      }
    },
    cloudHostMiniGames: []
  };
}

test("host reads creator mini-game templates and renders a launch action", () => {
  const state = fixtureState();
  assert.equal(creatorMiniGameTemplates(state).length, 1);
  const html = hostMiniGameCard(state);
  assert.match(html, /档案柜密码/);
  assert.match(html, /data-action="host-mini-game-start"/);
  assert.doesNotMatch(html, /2468/);
});

test("host launch sends the creator template and records the active game", async () => {
  const state = fixtureState();
  let sent;
  const messages = [];
  const handler = createHostMiniGameActionHandler({
    stateRef: state,
    apiRef: {
      startHostMiniGame: async (payload) => {
        sent = payload;
        return { currentGame: { id: "game-1", gameType: "zhimu_lock", status: "playing", attemptsLeft: 3, config: { title: payload.title } } };
      }
    },
    render() {},
    showToast: (message) => messages.push(message)
  });
  assert.equal(await handler("host-mini-game-start", { dataset: { templateId: "lock-1" } }), true);
  assert.equal(sent.answer, "2468");
  assert.equal(state.cloudHostMiniGames[0].id, "game-1");
  assert.ok(messages.includes("小游戏已同步到玩家端"));
});

test("host applies player progress and completion events", () => {
  const state = { cloudHostMiniGames: [{ id: "game-1", gameType: "zhimu_lock", status: "playing", attemptsLeft: 3 }] };
  applyHostMiniGameEvent("room.game_updated", {
    currentGame: { id: "game-1", gameType: "zhimu_lock", status: "playing", attemptsLeft: 2 }
  }, state);
  assert.equal(state.cloudHostMiniGames[0].attemptsLeft, 2);
  applyHostMiniGameEvent("room.game_completed", {
    currentGame: { id: "game-1", gameType: "zhimu_lock", status: "success", attemptsLeft: 2 }
  }, state);
  assert.equal(state.cloudHostMiniGames[0].status, "success");
});

test("host can recover or settle a revisioned mini-game", async () => {
  const state = fixtureState();
  state.cloudHostMiniGames = [{
    id: "game-1", gameType: "zhimu_lock", status: "timeout", revision: 4,
    config: { title: "档案柜", allow_recovery: true }
  }];
  const calls = [];
  const handler = createHostMiniGameActionHandler({
    stateRef: state,
    apiRef: {
      recoverHostMiniGame: async (id, payload) => {
        calls.push(["recover", id, payload]);
        return { currentGame: { id, gameType: "zhimu_lock", status: "playing", phase: "recovered", revision: 5 } };
      },
      settleHostMiniGame: async (id, payload) => {
        calls.push(["settle", id, payload]);
        return { currentGame: { id, gameType: "zhimu_lock", status: "success", revision: 6 } };
      }
    },
    render() {},
    showToast() {}
  });

  await handler("host-mini-game-recover", { dataset: { gameId: "game-1", revision: "4" } });
  assert.deepEqual(calls[0], ["recover", "game-1", { expectedRevision: 4, bonusAttempts: 1, timeoutSeconds: 300 }]);
  await handler("host-mini-game-settle-success", { dataset: { gameId: "game-1", revision: "5" } });
  assert.equal(calls[1][0], "settle");
  assert.equal(calls[1][2].expectedRevision, 5);
  assert.equal(calls[1][2].outcome, "success");
});
