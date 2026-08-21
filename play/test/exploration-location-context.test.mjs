import assert from "node:assert/strict";
import test from "node:test";

globalThis.localStorage = {
  getItem() { return ""; },
  setItem() {},
  removeItem() {},
};

const { state } = await import("../src/state.js");
const { renderExploration } = await import("../src/views/game-investigation-views.js");

test("exploration keeps the authoritative current map location above scene content", () => {
  const previous = {
    home: state.home,
    exploration: state.exploration,
    sessions: state.discoverySessions,
    error: state.explorationError,
  };
  state.home = {
    currentState: {
      presentation: {
        map: {
          title: "盐雾群岛",
          visible: true,
          activeLocationId: "dock",
          locations: [{ id: "dock", name: "旧码头", description: "潮线正在退去。" }],
        },
      },
    },
  };
  state.discoverySessions = [{
    locationId: "dock",
    phase: "drawing",
    drawnClueIds: ["clue-a"],
    remainingCount: 2,
  }];
  state.exploration = { scenes: [] };
  state.explorationError = "";

  const html = renderExploration();
  assert.match(html, /当前地图位置/);
  assert.match(html, /旧码头/);
  assert.match(html, /已抽 1 · 剩余 2/);
  assert.ok(html.indexOf("旧码头") < html.indexOf("当前还没有开放探索场景"));

  state.home = previous.home;
  state.exploration = previous.exploration;
  state.discoverySessions = previous.sessions;
  state.explorationError = previous.error;
});
