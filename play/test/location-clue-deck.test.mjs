import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizedCluesForLocation,
  clueArchiveCode,
  shuffledClueIds,
} from "../src/views/location-clue-deck.js";
import {
  discoveryNeedsReconciliation,
  handlePlayerStageAction,
  renderPlayerStageMap,
} from "../src/views/game-tabletop-stage.js";

test("location deck groups only already-authorized clues matching location or segment", () => {
  const clues = authorizedCluesForLocation(
    { id: "review-room", segmentKey: "authorization-review" },
    [
      { id: "owned-segment", segment_key: "authorization-review" },
      { id: "owned-other", segment_key: "appeal-route" },
      { id: "wrong-location-same-segment", location_id: "vault", segment_key: "authorization-review" },
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

test("a completed discovery reconciles when another authorized clue arrives", () => {
  const remote = {
    phase: "complete",
    drawnClueIds: ["clue-a"],
    remainingCount: 0,
    revision: 3,
  };
  assert.equal(discoveryNeedsReconciliation(remote, [{ id: "clue-a" }]), false);
  assert.equal(discoveryNeedsReconciliation(remote, [{ id: "clue-a" }, { id: "clue-b" }]), true);
  assert.equal(discoveryNeedsReconciliation({ ...remote, phase: "ready", remainingCount: 1 }, [
    { id: "clue-a" },
    { id: "clue-b" },
  ]), false);
});

test("player stage keeps clue text concealed until the server confirms the draw", async () => {
  const map = {
    title: "沉睡者的梦",
    visible: true,
    activeLocationId: "dream-gallery-test",
    locations: [{
      id: "dream-gallery-test",
      name: "梦境回廊",
      type: "意识场景",
      description: "散落的回声沿着无尽长廊漂浮。",
      segmentKey: "dream-memory-test",
      discovery: {
        scanLabel: "正在聆听旧日回声",
        scanHint: "回声将在片刻后汇聚",
        unlockLabel: "记忆层已开启",
        collectionLabel: "记忆碎片",
        countTemplate: "可回收 {count} 枚记忆碎片",
        archiveLabel: "MEMORY FRAGMENT",
      },
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
      name: "潮湿的童谣",
      public_text: "童谣的最后一句指向一扇没有门把的蓝门。",
      segment_key: "dream-memory-test",
      is_owner: true,
    }],
    sharedClues: [],
    discoverySessions: [{
      locationId: "dream-gallery-test",
      segmentKey: "dream-memory-test",
      phase: "scanning",
      drawnClueIds: [],
      remainingCount: 1,
      revision: 1,
    }],
  };

  const scanning = renderPlayerStageMap(map, context);
  assert.match(scanning, /正在聆听旧日回声/);
  assert.match(scanning, /回声将在片刻后汇聚/);
  assert.match(scanning, /可回收 1 枚记忆碎片/);
  assert.match(scanning, /MEMORY FRAGMENT/);
  assert.doesNotMatch(scanning, /蓝门/);

  const key = scanning.match(/data-discovery-key="([^"]+)"/)?.[1];
  const button = { dataset: { discoveryKey: key } };
  await handlePlayerStageAction({
    action: "tabletop-discovery-skip",
    button,
    syncDiscovery: async (input) => {
      assert.deepEqual(input, {
        action: "scan_ready",
        locationId: "dream-gallery-test",
        expectedRevision: 1,
      });
    },
  });
  context.discoverySessions = [{
    ...context.discoverySessions[0],
    phase: "ready",
    revision: 2,
  }];
  renderPlayerStageMap(map, context);
  await handlePlayerStageAction({
    action: "tabletop-draw-clue",
    button,
    syncDiscovery: async (input) => {
      assert.equal(input.action, "clue_drawn");
      assert.equal(input.expectedRevision, 2);
    },
  });
  context.discoverySessions = [{
    ...context.discoverySessions[0],
    phase: "complete",
    drawnClueIds: ["clue-a"],
    lastDrawnClueId: "clue-a",
    remainingCount: 0,
    revision: 3,
  }];

  const revealed = renderPlayerStageMap(map, context);
  assert.match(revealed, /记忆层已开启/);
  assert.match(revealed, /记忆碎片/);
  assert.doesNotMatch(revealed, /现场线索/);
  assert.match(revealed, /潮湿的童谣/);
  assert.match(revealed, /蓝门/);
  assert.match(revealed, /已抽取 1 \/ 1/);
});
