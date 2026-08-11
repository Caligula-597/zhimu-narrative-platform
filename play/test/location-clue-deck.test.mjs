import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizedCluesForLocation,
  clueArchiveCode,
  shuffledClueIds,
} from "../src/views/location-clue-deck.js";
import {
  handlePlayerStageAction,
  renderPlayerStageMap,
} from "../src/views/game-tabletop-stage.js";

test("location deck groups only already-authorized clues matching location or segment", () => {
  const clues = authorizedCluesForLocation(
    { id: "review-room", segmentKey: "authorization-review" },
    [
      { id: "owned-segment", segment_key: "authorization-review" },
      { id: "owned-other", segment_key: "appeal-route" },
    ],
    [
      { id: "shared-location", location_id: "review-room" },
      { id: "owned-segment", segment_key: "authorization-review" },
    ],
  );
  assert.deepEqual(clues.map((clue) => clue.id), ["owned-segment", "shared-location"]);
});

test("location deck shuffle is bounded and archive labels remain location-specific", () => {
  const order = shuffledClueIds(
    [{ id: "a" }, { id: "b" }, { id: "c" }],
    () => 0,
  );
  assert.deepEqual(order, ["b", "c", "a"]);
  assert.equal(clueArchiveCode({ segmentKey: "authorization-review" }, 1), "AUTHORIZATIO-02");
});

test("player stage keeps clue text concealed until the local draw interaction", () => {
  const map = {
    title: "联盟隔离服务器",
    visible: true,
    activeLocationId: "review-room-test",
    locations: [{
      id: "review-room-test",
      name: "授权审查室",
      type: "调查场景",
      description: "核对授权记录。",
      segmentKey: "authorization-review-test",
      x: 0.5,
      y: 0.5,
    }],
    routes: [],
    party: [],
    dice: { count: 1, sides: 20, modifier: 2, defaultTarget: 12 },
  };
  const context = {
    clues: [{
      id: "clue-a",
      name: "被覆盖的签发时间",
      public_text: "边缘仍能辨认出 23:40。",
      segment_key: "authorization-review-test",
      is_owner: true,
    }],
    sharedClues: [],
  };

  const scanning = renderPlayerStageMap(map, context);
  assert.match(scanning, /正在侦测现场痕迹/);
  assert.match(scanning, /1 条可发现线索/);
  assert.doesNotMatch(scanning, /23:40/);

  const key = scanning.match(/data-discovery-key="([^"]+)"/)?.[1];
  const button = { dataset: { discoveryKey: key } };
  handlePlayerStageAction({ action: "tabletop-discovery-skip", button });
  handlePlayerStageAction({ action: "tabletop-draw-clue", button });

  const revealed = renderPlayerStageMap(map, context);
  assert.match(revealed, /被覆盖的签发时间/);
  assert.match(revealed, /23:40/);
  assert.match(revealed, /已抽取 1 \/ 1/);
});
