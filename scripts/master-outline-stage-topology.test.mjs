/**
 * P8.0.1 Stage topology unit tests
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eligibleStageIndices,
  legacyAssignBeatToStageIndex,
  assignBeatsToStageIndices,
  planStageTopology,
  topologyRolesForCount,
} from "../shared/master-outline-stage-topology.js";

describe("P8.0.1 stage topology", () => {
  it("4-stage eligibility equals legacy band→index", () => {
    for (let band = 0; band <= 3; band += 1) {
      assert.deepEqual(eligibleStageIndices(band, 4), [legacyAssignBeatToStageIndex(band, 4)]);
    }
  });

  it("3-stage maps climax+resolution to final", () => {
    assert.deepEqual(eligibleStageIndices(0, 3), [0]);
    assert.deepEqual(eligibleStageIndices(1, 3), [1]);
    assert.deepEqual(eligibleStageIndices(2, 3), [2]);
    assert.deepEqual(eligibleStageIndices(3, 3), [2]);
  });

  it("5-stage uses eligibility windows ending at act5 for resolution", () => {
    assert.deepEqual(eligibleStageIndices(0, 5), [0]);
    assert.deepEqual(eligibleStageIndices(1, 5), [1, 2]);
    assert.deepEqual(eligibleStageIndices(2, 5), [2, 3]);
    assert.deepEqual(eligibleStageIndices(3, 5), [4]);
  });

  it("topology final role is PAYOFF for 3/4/5", () => {
    for (const n of [3, 4, 5]) {
      const roles = topologyRolesForCount(n);
      assert.equal(roles[n - 1].stageRole, "PAYOFF");
      assert.equal(roles[0].stageRole, "SETUP");
    }
  });

  it("locked project stages preserve ids and count", () => {
    const projectStages = [
      { id: "act1", label: "一", order: 0 },
      { id: "act2", label: "二", order: 1 },
      { id: "act3", label: "三", order: 2 },
      { id: "act4", label: "四", order: 3 },
      { id: "act5", label: "五", order: 4 },
    ];
    const topo = planStageTopology({ projectStages, beats: [] });
    assert.equal(topo.stageCountLocked, true);
    assert.equal(topo.targetStageCount, 5);
    assert.deepEqual(
      topo.slots.map((s) => s.id),
      ["act1", "act2", "act3", "act4", "act5"],
    );
  });

  it("assignment preserves per-block chronology", () => {
    const beats = [];
    for (const block of ["b1", "b2"]) {
      for (let band = 0; band <= 3; band += 1) {
        beats.push({ id: `${block}-${band}`, sourceBlockId: block, phaseBand: band });
      }
    }
    const map = assignBeatsToStageIndices(beats, 5);
    for (const block of ["b1", "b2"]) {
      let prev = -1;
      for (let band = 0; band <= 3; band += 1) {
        const idx = map.get(`${block}-${band}`);
        assert.ok(idx >= prev, `${block} band ${band} idx ${idx} < ${prev}`);
        prev = idx;
      }
      assert.equal(map.get(`${block}-3`), 4);
    }
  });

  it("4-stage assignment matches legacy for each band", () => {
    const beats = [];
    for (let band = 0; band <= 3; band += 1) {
      beats.push({ id: `x-${band}`, sourceBlockId: "x", phaseBand: band });
    }
    const map = assignBeatsToStageIndices(beats, 4);
    for (let band = 0; band <= 3; band += 1) {
      assert.equal(map.get(`x-${band}`), legacyAssignBeatToStageIndex(band, 4));
    }
  });
});
