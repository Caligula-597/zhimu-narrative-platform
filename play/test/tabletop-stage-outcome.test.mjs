import assert from "node:assert/strict";
import test from "node:test";
import { renderPlayerStageMap } from "../src/views/game-tabletop-stage.js";

test("player tabletop stage shows only applied changes and a host-published ending", () => {
  const html = renderPlayerStageMap({
    title: "盐雾群岛",
    visible: false,
    locations: [],
    activeCheck: {
      label: "穿过封锁",
      instruction: "说明行动方式。",
      target: 10,
      bonus: 0,
      rollMode: "normal",
      dice: { count: 1, sides: 20 },
      status: "resolved",
      result: {
        rolls: [15], rawTotal: 15, total: 15, target: 10, margin: 5,
        success: true, degreeLabel: "成功"
      },
      outcomeText: "队伍成功抵达港口。",
      appliedAt: "2026-08-10T14:00:00.000Z",
      appliedChanges: [{ id: "threat", label: "威胁", delta: -4, previous: 44, value: 40 }]
    },
    publishedEnding: {
      id: "escape",
      name: "潮汐撤离",
      summary: "队伍赶在封港前离开。",
      tone: "resolve"
    }
  });
  assert.match(html, /data-player-tabletop-check-changes/);
  assert.match(html, /威胁/);
  assert.match(html, /data-player-tabletop-ending/);
  assert.match(html, /潮汐撤离/);
  assert.doesNotMatch(html, /successEffects/);
});
