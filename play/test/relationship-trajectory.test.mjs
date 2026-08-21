import assert from "node:assert/strict";
import test from "node:test";

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { state } = await import("../src/state.js");
const { renderSuspicionsTab } = await import("../src/views/game-play-views.js");

test("players see authorized relationship history alongside private suspicions", () => {
  const previousHome = state.home;
  const previousRelationships = state.relationships;
  state.home = { role: { id: "role-a" }, roomMembers: [], suspicions: [] };
  state.relationships = [{
    relationshipId: "relationship-1",
    fromRoleName: "林墨",
    toRoleName: "周岚",
    publicLabel: "互相戒备",
    publicNote: "证词出现矛盾",
    currentStrength: -3,
    status: "strained",
    history: [{ strength: -3, status: "strained", note: "刚刚争执", changedAt: "2026-08-11T10:00:00.000Z" }],
  }];
  try {
    const html = renderSuspicionsTab();
    assert.match(html, /人物关系轨迹/);
    assert.match(html, /互相戒备/);
    assert.match(html, /刚刚争执/);
  } finally {
    state.home = previousHome;
    state.relationships = previousRelationships;
  }
});
