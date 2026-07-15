import assert from "node:assert/strict";
import test from "node:test";
import {
  STUDIO_SNAPSHOT_SQL,
  loadStudioSnapshot,
  queryStudioSnapshot
} from "../src/studio-snapshot-service.js";

test("queryStudioSnapshot preserves every studio domain in one database round trip", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          world: { id: "world-1", content_revision: "4" },
          chapters: [{ id: "chapter-1" }],
          roles: [{ id: "role-1" }],
          sections: [{ id: "section-1" }],
          scenes: [{ id: "scene-1" }],
          clues: [{ id: "clue-1" }],
          investigation_points: [{ id: "point-1" }],
          items: [{ id: "item-1" }],
          edges: [{ id: "edge-1" }],
          versions: [{ id: "version-1" }],
          rooms: [{ id: "room-1" }]
        }]
      };
    }
  };

  const snapshot = await queryStudioSnapshot({
    worldId: "world-1",
    actorId: "actor-1",
    client
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, STUDIO_SNAPSHOT_SQL);
  assert.deepEqual(calls[0].params, ["world-1", "actor-1"]);
  assert.equal(snapshot.world.content_revision, 4);
  assert.equal(snapshot.investigationPoints[0].id, "point-1");
  for (const field of [
    "chapters", "roles", "sections", "scenes", "clues",
    "items", "edges", "versions", "rooms"
  ]) {
    assert.equal(snapshot[field].length, 1, `${field} should be preserved`);
  }
});

test("queryStudioSnapshot keeps the empty response shape stable", async () => {
  const snapshot = await queryStudioSnapshot({
    worldId: "missing-world",
    actorId: "actor-1",
    client: { query: async () => ({ rows: [{ world: null }] }) }
  });

  assert.equal(snapshot.world, null);
  for (const [field, value] of Object.entries(snapshot)) {
    if (field !== "world") assert.deepEqual(value, []);
  }
});

test("loadStudioSnapshot uses one database call when chapter sequences are healthy", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          world: { id: "world-1", content_revision: 1 },
          chapters: [{ id: "chapter-1", sequence: 1 }]
        }]
      };
    }
  };

  const snapshot = await loadStudioSnapshot({
    worldId: "world-1",
    actorId: "actor-1",
    client
  });

  assert.equal(snapshot.world.id, "world-1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, STUDIO_SNAPSHOT_SQL);
});

test("loadStudioSnapshot rejects actors without a readable world", async () => {
  await assert.rejects(
    loadStudioSnapshot({
      worldId: "world-1",
      actorId: "actor-1",
      client: { query: async () => ({ rows: [{ world: null }] }) }
    }),
    (error) => error.code === "WORLD_ACCESS_DENIED" && error.statusCode === 403
  );
});
