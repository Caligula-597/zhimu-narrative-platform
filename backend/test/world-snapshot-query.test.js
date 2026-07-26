import assert from "node:assert/strict";
import test from "node:test";
import { buildWorldSnapshot, WORLD_SNAPSHOT_SQL } from "../src/world-snapshot-service.js";

test("buildWorldSnapshot loads every domain in one database round trip", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          world: { id: "world-1", name: "测试世界" },
          chapters: [{ id: "chapter-1" }],
          roles: [{ id: "role-1" }],
          sections: [{ id: "section-1" }],
          scenes: [{ id: "scene-1" }],
          clues: [{ id: "clue-1" }],
          investigation_points: [{ id: "point-1" }],
          items: [{ id: "item-1", name: "道具" }],
          edges: [{ id: "edge-1" }],
          rules: [{ id: "rule-1" }],
          rooms: [{ id: "room-1" }],
          segments: [{ id: "segment-1" }]
        }]
      };
    }
  };

  const snapshot = await buildWorldSnapshot("world-1", client);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, WORLD_SNAPSHOT_SQL);
  assert.deepEqual(calls[0].params, ["world-1"]);
  assert.equal(snapshot.world.id, "world-1");
  assert.equal(snapshot.investigationPoints[0].id, "point-1");
  for (const field of ["chapters", "roles", "sections", "scenes", "clues", "items", "edges", "rules", "rooms", "segments"]) {
    assert.equal(snapshot[field].length, 1, `${field} should be preserved`);
  }
});

test("buildWorldSnapshot preserves the legacy empty snapshot shape", async () => {
  const snapshot = await buildWorldSnapshot("missing-world", {
    query: async () => ({ rows: [{ world: null }] })
  });

  assert.equal(snapshot.world, undefined);
  for (const value of Object.values(snapshot).filter(Array.isArray)) assert.deepEqual(value, []);
});
