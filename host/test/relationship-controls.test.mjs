import assert from "node:assert/strict";
import test from "node:test";
import { state } from "../src/state.js";
import { renderHostCommandCenter } from "../src/views/host-layout.js";

test("host relationship controls expose disclosure, status and optimistic revision", () => {
  const previous = state.cloudHostRelationships;
  state.cloudHostRelationships = [{
    relationshipId: "relationship-1",
    fromRoleName: "林墨",
    toRoleName: "周岚",
    authoredLabel: "旧友",
    authoredStrength: 2,
    currentStrength: -3,
    status: "strained",
    disclosure: "involved",
    publicNote: "证词出现矛盾",
    revision: 4,
  }];
  try {
    const html = renderHostCommandCenter({ room: {}, world: {}, playersTableRows: () => "" });
    assert.match(html, /关系状态调配/);
    assert.match(html, /data-relationship-id="relationship-1"/);
    assert.match(html, /data-revision="4"/);
    assert.match(html, /关系双方/);
  } finally {
    state.cloudHostRelationships = previous;
  }
});
