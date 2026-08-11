import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMiniGameTemplate } from "../../shared/mini-game-protocol.js";
import {
  buildLockGameConfig,
  publicMiniGame,
  recoverMiniGame,
  settleMiniGame,
  submitMiniGameAnswer,
} from "../src/room-mini-games.js";

function row(overrides = {}) {
  return {
    id: "game-1",
    room_id: "room-1",
    protocol_version: 1,
    game_type: "zhimu_lock",
    title: "档案柜",
    public_config: { title: "档案柜", max_attempts: 3, allow_recovery: true },
    private_config: { answer_hash: "secret-hash" },
    state: { attempts_left: 2, attempts_used: 1, recovery_count: 0 },
    status: "active",
    revision: 3,
    settlement: {},
    deadline_at: null,
    ...overrides,
  };
}

function clientWithRows(rows) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [rows.shift()] };
    },
  };
}

test("creator mini-game template normalizes into the stable v1 plugin contract", () => {
  const template = normalizeMiniGameTemplate({
    id: "lock-a",
    answer: "2468",
    timeoutSeconds: 90,
    allowRecovery: false,
  });
  assert.equal(template.protocolVersion, 1);
  assert.equal(template.pluginKey, "zhimu_lock");
  assert.equal(template.length, 4);
  assert.equal(template.timeoutSeconds, 90);
  assert.equal(template.allowRecovery, false);
});

test("public mini-game projection never exposes answer material or private recap data", () => {
  const projected = publicMiniGame(row({
    status: "completed",
    settlement: {
      outcome: "success",
      publicSummary: "机关开启",
      recapData: { hostSecret: "do-not-project" },
      settledAt: "2026-08-11T00:00:00.000Z",
    },
  }));
  assert.equal(projected.status, "success");
  assert.equal(projected.settlement.publicSummary, "机关开启");
  assert.equal(projected.settlement.recapData, undefined);
  assert.equal(JSON.stringify(projected).includes("secret-hash"), false);
  assert.equal(JSON.stringify(projected).includes("do-not-project"), false);
});

test("stale player submissions fail before mutating the mini-game", async () => {
  const client = clientWithRows([row({ revision: 4 })]);
  await assert.rejects(
    submitMiniGameAnswer(client, {
      roomId: "room-1",
      gameId: "game-1",
      actorUserId: "player-1",
      answer: "2468",
      expectedRevision: 3,
    }),
    (error) => error.code === "MINI_GAME_VERSION_CONFLICT",
  );
  assert.equal(client.calls.length, 1);
});

test("elapsed submissions persist a timeout instead of consuming another attempt", async () => {
  const timedOut = row({
    status: "timed_out",
    revision: 4,
    deadline_at: "2026-08-10T00:00:00.000Z",
    state: { attempts_left: 2, attempts_used: 1, phase: "timed_out" },
  });
  const client = clientWithRows([
    row({ deadline_at: "2026-08-10T00:00:00.000Z" }),
    timedOut,
  ]);
  const result = await submitMiniGameAnswer(client, {
    roomId: "room-1",
    gameId: "game-1",
    actorUserId: "player-1",
    answer: "wrong",
    expectedRevision: 3,
  });
  assert.equal(result.timedOut, true);
  assert.equal(result.game.status, "timeout");
  assert.equal(result.game.attemptsLeft, 2);
});

test("host recovery reopens a failed game with a new revision and attempt budget", async () => {
  const recovered = row({
    status: "active",
    revision: 6,
    state: { attempts_left: 2, attempts_used: 3, recovery_count: 1, phase: "recovered" },
  });
  const client = clientWithRows([row({ status: "failed", revision: 5 }), recovered]);
  const result = await recoverMiniGame(client, {
    roomId: "room-1",
    gameId: "game-1",
    actorUserId: "host-1",
    expectedRevision: 5,
    bonusAttempts: 2,
    timeoutSeconds: 300,
  });
  assert.equal(result.status, "playing");
  assert.equal(result.phase, "recovered");
  assert.equal(result.revision, 6);
  assert.equal(result.attemptsLeft, 2);
});

test("host settlement stores recap data but only projects its public summary", async () => {
  const settled = row({
    status: "completed",
    revision: 4,
    settlement: {
      outcome: "success",
      publicSummary: "全员完成协作",
      recapData: { internalScore: 99 },
      settledAt: "2026-08-11T00:00:00.000Z",
    },
  });
  const client = clientWithRows([row(), settled]);
  const result = await settleMiniGame(client, {
    roomId: "room-1",
    gameId: "game-1",
    actorUserId: "host-1",
    expectedRevision: 3,
    outcome: "success",
    publicSummary: "全员完成协作",
    recapData: { internalScore: 99 },
  });
  assert.equal(result.status, "success");
  assert.deepEqual(result.settlement, {
    outcome: "success",
    publicSummary: "全员完成协作",
    settledAt: "2026-08-11T00:00:00.000Z",
  });
});

test("lock adapter keeps answer hashing out of its public configuration", () => {
  const config = buildLockGameConfig({ answer: "2468", title: "档案柜" });
  assert.equal(config.publicConfig.answer, undefined);
  assert.equal(config.privateConfig.answer_hash.length, 64);
  assert.equal(config.privateConfig.answer_hash.includes("2468"), false);
});
