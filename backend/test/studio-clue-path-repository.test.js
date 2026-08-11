import assert from "node:assert/strict";
import test from "node:test";
import {
  bulkUpdateStudioCluePaths,
  findStudioCluePathReferences
} from "../src/repositories/studio-scene-clue-repository.js";

function clientWith(result) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      const indexes = [...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
      assert.equal(Math.max(0, ...indexes), params.length);
      return result;
    }
  };
}

test("bulk clue path binding updates one world-scoped set in one statement", async () => {
  const client = clientWith({ rows: [{ id: "clue-1" }, { id: "clue-2" }] });
  const rows = await bulkUpdateStudioCluePaths(client, {
    worldId: "world-1",
    clueIds: ["clue-1", "clue-2"],
    locationId: "library",
    segmentKey: "ch2",
    allowUnbound: false
  });
  assert.equal(rows.length, 2);
  assert.equal(client.calls.length, 1);
  assert.match(client.calls[0].sql, /id = ANY\(\$2::uuid\[\]\)/);
  assert.match(client.calls[0].sql, /jsonb_build_object/);
  assert.deepEqual(client.calls[0].params, [
    "world-1",
    ["clue-1", "clue-2"],
    "library",
    "ch2",
    false
  ]);
});

test("clue path reference lookup validates segment and map from one world", async () => {
  const stored = {
    settings: { tabletopMapDesign: { locations: [{ id: "library" }] } },
    segment_exists: true
  };
  const client = clientWith({ rows: [stored] });
  const result = await findStudioCluePathReferences(client, {
    worldId: "world-1",
    segmentKey: "ch2"
  });
  assert.equal(result, stored);
  assert.match(client.calls[0].sql, /world_segments/);
  assert.deepEqual(client.calls[0].params, ["world-1", "ch2"]);
});
