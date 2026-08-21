import assert from "node:assert/strict";
import test from "node:test";
import { state } from "../src/state.js";
import { renderHostCommandCenter } from "../src/views/host-layout.js";

test("host discovery mirror exposes role-location counts without clue identities", () => {
  const previous = state.cloudHostDiscoveryProgress;
  state.cloudHostDiscoveryProgress = {
    locations: [{ id: "library", name: "档案室", segmentKey: "act-2" }],
    players: [{ roleSlotId: "role-1", roleName: "记录员", displayName: "玩家甲", joined: true }],
    sessions: [{
      roleSlotId: "role-1",
      locationId: "library",
      phase: "drawing",
      drawnCount: 2,
      remainingCount: 1,
    }],
  };
  const html = renderHostCommandCenter({
    room: { name: "测试房" },
    world: { name: "测试世界" },
    playersTableRows: () => "",
    presentation: {
      map: {
        title: "调查地图",
        visible: true,
        activeLocationId: "library",
        revealedLocationIds: ["library"],
        locations: [{ id: "library", name: "档案室", x: 0.5, y: 0.5 }],
        routes: [],
        party: [],
        dice: {},
        host: {
          locations: [{ id: "library", name: "档案室", segmentKey: "act-2", x: 0.5, y: 0.5 }],
          variables: [],
          endingCount: 0,
        },
      },
    },
  });
  assert.match(html, /角色 × 地点探索进度/);
  assert.match(html, /玩家甲/);
  assert.match(html, /2 已抽 · 1 剩余/);
  assert.doesNotMatch(html, /drawnClueIds|remainingClueIds|clue-secret/);
  state.cloudHostDiscoveryProgress = previous;
});
