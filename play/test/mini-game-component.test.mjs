import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMiniGame, renderMiniGamePanel } from "../src/components/mini-games.js";

test("player mini-game renders revisioned recovery and never renders private settlement data", () => {
  const game = normalizeMiniGame({
    id: "game-1",
    instanceId: "game-1",
    gameType: "zhimu_lock",
    revision: 7,
    phase: "recovered",
    status: "playing",
    attemptsLeft: 1,
    config: { title: "档案柜", length: 4 },
  });
  assert.equal(game.revision, 7);
  assert.match(renderMiniGamePanel(game), /机关已恢复/);

  const completed = renderMiniGamePanel({
    ...game,
    status: "success",
    settlement: { publicSummary: "机关开启", recapData: { secret: "hidden" } },
  });
  assert.match(completed, /机关开启/);
  assert.doesNotMatch(completed, /hidden/);
});

test("player sees a distinct timeout state with recovery guidance", () => {
  const html = renderMiniGamePanel({
    instanceId: "game-1",
    gameType: "zhimu_lock",
    status: "timeout",
    config: { title: "档案柜" },
  });
  assert.match(html, /挑战时间已到/);
  assert.match(html, /恢复新的尝试窗口/);
});
